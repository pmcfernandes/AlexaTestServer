# Alexa Skill Test Server & Dashboard

A powerful, centralized dashboard to manage, deploy, and monitor multiple Alexa Skills running on a local server. This tool automates the process of cloning repositories, managing environment variables, editing interaction models, and exposing local services via Cloudflare tunnels.

## Features

-  **Multi-Skill Management**: Clone, update (pull), and delete multiple skills from a single interface.
-  **Environment Config**: Edit and save `.env` files for each skill directly from the dashboard.
-  **Interaction Models**: View, edit, and copy Alexa interaction models (`models/*.json`).
-  **Automated Tunneling**: Integrated Cloudflared support to automatically expose your local skill to a public URL for Alexa developer console integration.
-  **Process Control**: Start, stop, and restart skills independently of the tunnel.
-  **Real-time Logs**: Monitor both the skill server and the Cloudflare tunnel logs in real-time.
-  **Modern UI**: A sleek, vertical-layout dashboard with dark mode aesthetics and responsive design.

## Prerequisites

- **Node.js**: Required to run the dashboard and most Alexa skills.
- **Git**: Required for cloning and pulling skill repositories.
- **Cloudflared**: Ensure `cloudflared` is installed and available in your system path.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/pmcfernandes/AlexaTestServer.git
   cd alexa_server
   ```

2. Install dependencies for the backend and frontend:
   ```bash
   # Root directory (backend)
   npm install

   # Client directory (frontend)
   cd client
   npm install
   ```

## Running the Dashboard

1. **Start the Backend Server**:
   From the root directory:
   ```bash
   npm start
   ```
   *Defaults to port 5001. You can change this via the `PORT` environment variable.*

2. **Start the Frontend (Development)**:
   From the `client` directory:
   ```bash
   npm run dev
   ```
   *The dev server will proxy API requests to the backend.*

## Usage

1. **Add a New Skill**: Click "New Skill" at the top of the sidebar, provide a name and a Git URL.
2. **Configure**: Select the skill, set your `.env` variables (e.g., `PORT`, `ALEXA_SKILL_ID`), and save.
3. **Deploy**: Click **Publish** to run `npm install`, start the skill server, and establish the Cloudflare tunnel.
4. **Integration**: Copy the generated Cloudflare URL and paste it into the "Endpoint" section of your Alexa Developer Console.

