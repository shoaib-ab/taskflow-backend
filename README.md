# TaskFlow — Backend

Node.js / Express REST API. Runs with a local MongoDB container via Docker, or connects to MongoDB Atlas for production.

---

## Prerequisites

| Tool                                                                         | Purpose                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/)            | Run the app + MongoDB in containers          |
| [Node.js 20+](https://nodejs.org/)                                           | Only needed for local dev **without** Docker |
| [MongoDB Compass](https://www.mongodb.com/try/download/compass) _(optional)_ | GUI to inspect the local database            |

---

## Does Docker remove the need for a `.env` file?

**No.** This is a common misconception.

Docker does **not** bundle or auto-generate secrets. The `env_file: .env` line in `docker-compose.yaml` simply tells Docker to **read** a `.env` file that must already exist on the developer's machine. It is intentionally **not** committed to git because it contains secrets (JWT keys, Cloudinary credentials, etc.).

Every developer needs their own `.env`. The `.env.example` file (committed to git) lists every required variable with placeholder values — use it as the template.

---

## What is a Docker image and what happens when you build one?

### What is an image?

A Docker **image** is a snapshot of your application — it contains the OS layer (Alpine Linux), the Node.js runtime, your `node_modules`, and your source code, all packaged into a single file. Think of it like a ZIP of the entire environment needed to run your app.

A **container** is just a running instance of that image. You can start and stop many containers from the same image.

### What is the benefit?

| Without Docker                                         | With Docker                                   |
| ------------------------------------------------------ | --------------------------------------------- |
| Every developer installs Node, npm, MongoDB separately | One command — everything runs identically     |
| "Works on my machine" problems                         | Every machine runs the exact same environment |
| Manual setup steps                                     | `docker compose up --build` and done          |

### Is the image we build meant for other developers?

**In this project — no.** With `docker compose up --build`, Docker **builds the image locally** on each developer's machine from the `Dockerfile`. No image is shared or pushed anywhere.

The image is just an intermediate step Docker uses to spin up the container. Other developers don't receive your image — they build their own identical one from the same `Dockerfile` that is committed to git.

Sharing a pre-built image (via Docker Hub or a registry) is a **production / CI-CD concern**, not a development one.

### If you update the code, do you need to rebuild the image?

It depends on what changed:

| What changed                             | Action needed                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| A `.js` source file                      | **Nothing** — nodemon hot-reloads inside the running container automatically    |
| `package.json` (added/removed a package) | `docker compose up --build` — re-runs `npm install`                             |
| `Dockerfile` or `docker-compose.yaml`    | `docker compose up --build`                                                     |
| Only `.env` values                       | `docker compose down && docker compose up -d` — no rebuild needed, just restart |

### Can other developers update the image?

Yes — because the image is built locally from the `Dockerfile` (which is in git), any developer can rebuild it with `docker compose up --build` after pulling the latest code. There is no central image to "push to". The `Dockerfile` **is** the source of truth for the image.

---

## First-time setup (any developer)

1. Clone the repo.
2. Copy `.env.example` to `.env` and fill in the real values:
   ```bash
   cp .env.example .env
   # then open .env and replace placeholder values with real credentials
   ```
3. Make sure Docker Desktop is running.
4. From the `backend/` folder:

```bash
docker compose up --build
```

That's it. Docker pulls MongoDB, installs Node dependencies, and starts the server on `http://localhost:5000`.

> No need to run `npm install` manually — it runs inside the container.

---

## Daily workflow

### Start the stack

```bash
# First time, or after changing Dockerfile / package.json / docker-compose.yaml
docker compose up --build

# Every other time (images already built, just start containers)
docker compose up -d

# Equivalent explicit form (useful if you have multiple compose files)
docker compose -f docker-compose.yaml up -d
```

### Stop the stack

```bash
docker compose down
```

### View logs

```bash
docker compose logs -f backend
```

---

## When to use `--build` vs just `up`

| Situation                                               | Command                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| First time running the project                          | `docker compose up --build`                                |
| Added / updated an npm package (`package.json` changed) | `docker compose up --build`                                |
| Changed the `Dockerfile` or `docker-compose.yaml`       | `docker compose up --build`                                |
| Changed any source code (`.js` files)                   | `docker compose up -d` — nodemon hot-reloads automatically |
| Resuming work after shutting down your machine          | `docker compose up -d`                                     |

---

## MongoDB

### Current setup — local container (default)

MongoDB runs as a Docker container named `taskflow-mongo`. The backend connects to it via `mongodb://mongo:27017/taskflow` (Docker's internal network, not `localhost`).

Data persists in the `mongo_data` Docker volume — it survives `docker compose down`.  
To wipe the database completely: `docker compose down -v`

---

### Switching to MongoDB Atlas

**Step 1 — `.env`**: comment out the local URI and uncomment the Atlas one:

```dotenv
# MONGO_URI=mongodb://127.0.0.1:27017/taskflow
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/taskflow?appName=<appName>
```

**Step 2 — `docker-compose.yaml`**: remove the three sections highlighted below:

```yaml
services:
  backend:
    ...
    env_file:
      - .env
    # ❌ DELETE — no longer need to override MONGO_URI, Atlas URI comes from .env
    environment:
      - MONGO_URI=mongodb://mongo:27017/taskflow
    # ❌ DELETE — no local mongo container to wait for
    depends_on:
      mongo:
        condition: service_healthy
    volumes:
      ...

  # ❌ DELETE the entire mongo service block
  mongo:
    image: mongo:7
    ...

# ❌ DELETE the volumes section
volumes:
  mongo_data:
```

After those deletions `docker-compose.yaml` will look like this:

```yaml
version: '3.9'

services:
  backend:
    build:
      context: .
      target: development
    container_name: taskflow-backend
    command: npm run dev
    restart: unless-stopped
    ports:
      - '5000:5000'
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
```

Then rebuild:

```bash
docker compose up --build
```

---

## Local development (without Docker)

Only use this if you have a local MongoDB instance running on port 27017.

```bash
npm install
npm run dev
```

---

## Production image

### What is it and who is it for?

The production image is **not for developers** — it is for deploying the app to a server (e.g. AWS, Railway, Render, a VPS). It is a smaller, optimised image because:

- It runs `npm install --omit=dev` — devDependencies like `nodemon` are excluded
- It starts the server with `node server.js` directly — no hot-reload, no file watching
- Your source code is **copied into** the image at build time (no volume mount)

Developers use `docker compose up --build` (dev stage). A server uses the production image.

---

### When and who builds the production image?

In a professional workflow, a **CI/CD pipeline** (e.g. GitHub Actions) builds and pushes the production image to a registry (Docker Hub, AWS ECR, etc.) automatically every time you push to `main`. The server then pulls and runs the latest image.

In a simple / solo setup, you build and push it manually.

---

### How to build and run it locally

```bash
# Build the production image and tag it
docker build --target production -t taskflow-backend:prod .

# Run it (pass env variables from your .env file)
docker run --env-file .env -p 5000:5000 taskflow-backend:prod
```

> Note: unlike the dev setup, there is no volume mount here. The code is baked into the image. Changes to source files require a rebuild.

---

### How to update the production image after a code change

Because the code is baked in, you must rebuild and redeploy every time:

```bash
# Rebuild with a new version tag
docker build --target production -t taskflow-backend:prod:v2 .

# Push to a registry (e.g. Docker Hub)
docker push yourdockerhubusername/taskflow-backend:v2
```

Then on your server, pull and restart:

```bash
docker pull yourdockerhubusername/taskflow-backend:v2
docker stop taskflow-backend
docker run --env-file .env -p 5000:5000 yourdockerhubusername/taskflow-backend:v2
```

---

### Dev image vs Production image — summary

|                              | Dev (`docker compose up --build`)      | Production (`docker build --target production`) |
| ---------------------------- | -------------------------------------- | ----------------------------------------------- |
| Who uses it                  | Developers                             | Server / deployment                             |
| Code location                | Mounted from your machine (live edits) | Baked into the image at build time              |
| Hot-reload                   | Yes (nodemon)                          | No                                              |
| devDependencies              | Included                               | Excluded (smaller image)                        |
| Start command                | `npm run dev`                          | `node server.js`                                |
| Needs rebuild on code change | No                                     | Yes                                             |
