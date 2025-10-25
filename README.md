# Hello World Web Example

A simple Hello World web application built with Node.js.

## Features

- Simple HTTP server using Node.js
- Beautiful, animated Hello World page
- No external dependencies required

## Getting Started

### Prerequisites

- Node.js (any recent version)

### Installation

No installation required! This project uses only Node.js built-in modules.

### Running the Application

1. Start the server:
   ```bash
   npm start
   ```
   or
   ```bash
   node server.js
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. You should see a beautiful "Hello World!" message.

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Project Structure

```
.
├── index.html    # The Hello World HTML page
├── server.js     # Node.js HTTP server
├── package.json  # Project configuration
└── README.md     # This file
```

## License

ISC
