#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';

// Read MySQL connection details from environment variables
const MYSQL_HOST = process.env.MYSQL_HOST;
const MYSQL_USER = process.env.MYSQL_USER;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
const MYSQL_PORT = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306; // Default MySQL port
const MYSQL_ALLOW_WRITE_OPS = process.env.MYSQL_ALLOW_WRITE_OPS === 'true'; // Check for write operations flag

if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
  console.error('Missing MySQL connection environment variables (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)');
  process.exit(1); // Exit if essential config is missing
}

const connectionConfig = {
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  port: MYSQL_PORT,
};

// Type guard for query arguments
const isValidQueryArgs = (args: any): args is { sql: string } =>
  typeof args === 'object' && args !== null && typeof args.sql === 'string';

// Type guard for write operation arguments (can be generalized if needed)
const isValidWriteArgs = (args: any): args is { sql: string } =>
  typeof args === 'object' && args !== null && typeof args.sql === 'string';


class MysqlServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mysql-server',
        version: '0.1.0',
        description: 'MCP Server for interacting with a MySQL database',
      },
      {
        capabilities: {
          resources: {}, // No resources defined for this simple example
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query',
          description: 'Execute a read-only SQL query against the configured MySQL database.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SQL query to execute.',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'insert',
          description: 'Execute an INSERT SQL statement. Requires MYSQL_ALLOW_WRITE_OPS=true.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'The INSERT SQL statement.' },
            },
            required: ['sql'],
          },
        },
        {
          name: 'update',
          description: 'Execute an UPDATE SQL statement. Requires MYSQL_ALLOW_WRITE_OPS=true.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'The UPDATE SQL statement.' },
            },
            required: ['sql'],
          },
        },
        {
          name: 'delete',
          description: 'Execute a DELETE SQL statement. Requires MYSQL_ALLOW_WRITE_OPS=true.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'The DELETE SQL statement.' },
            },
            required: ['sql'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments;

      // Handle query tool (read-only)
      if (toolName === 'query') {
        if (!isValidQueryArgs(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for query tool. Expected { "sql": "..." }'
          );
        }
        const sqlQuery = args.sql;
        const lowerCaseQuery = sqlQuery.toLowerCase().trim();
        // Ensure query tool remains strictly read-only
        if (!lowerCaseQuery.startsWith('select') && !lowerCaseQuery.startsWith('show') && !lowerCaseQuery.startsWith('describe')) {
          return {
            content: [{ type: 'text', text: 'Error: Only SELECT, SHOW, or DESCRIBE queries are allowed for the "query" tool.' }],
            isError: true,
          };
        }
        return this.executeQuery(sqlQuery);
      }

      // Handle write tools (insert, update, delete)
      if (['insert', 'update', 'delete'].includes(toolName)) {
        // Check if write operations are enabled
        if (!MYSQL_ALLOW_WRITE_OPS) {
          return {
            content: [{ type: 'text', text: `Error: Write operations are disabled. Set MYSQL_ALLOW_WRITE_OPS=true in MCP settings to enable ${toolName}.` }],
            isError: true,
          };
        }

        if (!isValidWriteArgs(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments for ${toolName} tool. Expected { "sql": "..." }`
          );
        }

        const sqlStatement = args.sql;
        const lowerCaseStatement = sqlStatement.toLowerCase().trim();

        // Basic safety check for statement type matching tool name
        if (!lowerCaseStatement.startsWith(toolName)) {
           return {
             content: [{ type: 'text', text: `Error: SQL statement does not appear to be a valid ${toolName.toUpperCase()} statement.` }],
             isError: true,
           };
        }

        return this.executeWrite(sqlStatement, toolName);
      }

      // Unknown tool
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${toolName}`
      );
    });
  }

  // Helper function for executing read queries
  private async executeQuery(sqlQuery: string) {
      let connection: mysql.Connection | null = null;
      try {
        connection = await mysql.createConnection(connectionConfig);
        const [rows] = await connection.execute(sqlQuery);
        await connection.end();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rows, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value, 2),
            },
          ],
        };
      } catch (error: any) {
        if (connection) await connection.end();
        return {
          content: [{ type: 'text', text: `MySQL Query Error: ${error.message}` }],
          isError: true,
        };
      }
  }

  // Helper function for executing write statements (INSERT, UPDATE, DELETE)
  private async executeWrite(sqlStatement: string, operation: string) {
      let connection: mysql.Connection | null = null;
      try {
        connection = await mysql.createConnection(connectionConfig);
        const [result] = await connection.execute(sqlStatement) as [mysql.ResultSetHeader, any]; // Type assertion for result
        await connection.end();

        // Provide feedback based on the operation type
        let message = `${operation.toUpperCase()} successful.`;
        if ('affectedRows' in result) {
            message += ` Affected rows: ${result.affectedRows}.`;
        }
        if ('insertId' in result && result.insertId !== 0) { // insertId is 0 for non-auto-increment inserts
            message += ` Insert ID: ${result.insertId}.`;
        }

        return {
          content: [{ type: 'text', text: message }],
        };
      } catch (error: any) {
        if (connection) await connection.end();
        return {
          content: [{ type: 'text', text: `MySQL ${operation.toUpperCase()} Error: ${error.message}` }],
          isError: true,
        };
      }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MySQL MCP server running on stdio');
  }
}

const server = new MysqlServer();
server.run().catch((err) => {
  console.error("Failed to start MySQL MCP server:", err);
  process.exit(1);
});
