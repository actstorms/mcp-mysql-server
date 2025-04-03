# MySQL MCP Server

Version: 0.1.0

A Model Context Protocol (MCP) server for interacting with a MySQL database. This server allows MCP clients (like AI assistants) to query and modify data in a configured MySQL database.

## Features

*   Connects to a MySQL database using standard connection parameters.
*   Provides MCP tools for executing SQL queries and statements.
*   Supports read-only queries (`SELECT`, `SHOW`, `DESCRIBE`).
*   Supports write operations (`INSERT`, `UPDATE`, `DELETE`) via separate tools, gated by an environment variable (`MYSQL_ALLOW_WRITE_OPS`).
*   Communicates over standard input/output (stdio).

## Installation

```bash
# Install as a project dependency (recommended for use within another project)
npm install

# Or, if intended as a standalone global tool:
# 1. Build the project:
#    npm run build
# 2. Link it globally:
#    npm link 
#    (or use `npm install -g .` if publishing)
```

## Configuration

This server requires the following environment variables to be set for database connection:

*   `MYSQL_HOST`: The hostname or IP address of your MySQL server.
*   `MYSQL_USER`: The username for connecting to the database.
*   `MYSQL_PASSWORD`: The password for the specified user.
*   `MYSQL_DATABASE`: The name of the database to connect to.
*   `MYSQL_PORT`: (Optional) The port number for the MySQL server (defaults to 3306).
*   `MYSQL_ALLOW_WRITE_OPS`: (Optional) Set to `true` to enable the `insert`, `update`, and `delete` tools. Defaults to `false` (write operations disabled). **Warning:** Enabling write operations allows the MCP client to modify your database. Use with caution.

These variables need to be available in the environment where the server process is launched. How you set them depends on your operating system and how you run the server (e.g., `.env` file, system environment variables, shell export).

## Usage

Once configured and built (`npm run build`), you can run the server:

```bash
# If linked globally
mysql-server

# Or run directly using node
node build/index.js 
```

The server will start and print `MySQL MCP server running on stdio` to stderr, then listen for MCP requests on standard input/output. You would typically configure your MCP client (e.g., an AI assistant integration) to connect to this server process.

## Available Tools

The server exposes the following tools for use by MCP clients:

### 1. `query`

*   **Description:** Executes a read-only SQL query (SELECT, SHOW, DESCRIBE) against the configured database.
*   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "sql": {
          "type": "string",
          "description": "The read-only SQL query (SELECT, SHOW, DESCRIBE) to execute."
        }
      },
      "required": ["sql"]
    }
    ```
*   **Output:** Returns the query results as a JSON string within the MCP response `content`. Returns an error if the query is not read-only or if there's a database error.

### 2. `insert`

*   **Description:** Executes an INSERT SQL statement. **Requires `MYSQL_ALLOW_WRITE_OPS` to be set to `true`.**
*   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "sql": {
          "type": "string",
          "description": "The INSERT SQL statement to execute."
        }
      },
      "required": ["sql"]
    }
    ```
*   **Output:** Returns a success message including affected rows and insert ID (if applicable), or an error message if the operation fails or write operations are disabled.

### 3. `update`

*   **Description:** Executes an UPDATE SQL statement. **Requires `MYSQL_ALLOW_WRITE_OPS` to be set to `true`.**
*   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "sql": {
          "type": "string",
          "description": "The UPDATE SQL statement to execute."
        }
      },
      "required": ["sql"]
    }
    ```
*   **Output:** Returns a success message including affected rows, or an error message if the operation fails or write operations are disabled.

### 4. `delete`

*   **Description:** Executes a DELETE SQL statement. **Requires `MYSQL_ALLOW_WRITE_OPS` to be set to `true`.**
*   **Input Schema:**
    ```json
    {
      "type": "object",
      "properties": {
        "sql": {
          "type": "string",
          "description": "The DELETE SQL statement to execute."
        }
      },
      "required": ["sql"]
    }
    ```
*   **Output:** Returns a success message including affected rows, or an error message if the operation fails or write operations are disabled.

## Development

To work on the server code:

1.  **Clone the repository:** (If applicable)
    ```bash
    # git clone <repository-url>
    # cd mysql-server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build the code:** (Compiles TypeScript to JavaScript in `build/`)
    ```bash
    npm run build
    ```
4.  **Watch for changes:** (Automatically recompiles on changes)
    ```bash
    npm run watch
    ```
5.  **Run the MCP Inspector:** (For testing/debugging the server locally)
    ```bash
    # Make sure you have built the code first
    npm run inspector 
    ```

## License

(This project is currently private - `private: true` in package.json. Add license info here if it becomes public.)
