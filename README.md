# 🌉 CodeBridge

### Bridge your phone and laptop. Code. Connect. Transfer.

**CodeBridge** is a web platform designed to make sharing code snippets and files between devices simple and convenient. Using room-code-based pairing, users can connect devices and exchange content through a browser.

The project explores how modern web technologies, backend services, and cloud deployment can work together to create a practical cross-device sharing experience.

---

## ✨ Features

- 🔗 **Room-Code Pairing** — Create or join a room using a room code.
- 💻 **Code Sharing** — Share code snippets between connected devices.
- 📁 **File Transfer** — Transfer files between devices through the platform.
- 📱 **Cross-Device Access** — Access the platform using a compatible web browser.
- ⚡ **Simple Interface** — Designed to make connecting and sharing straightforward.
- ☁️ **Cloud Deployment** — Deployed using Google Cloud Run.
- 🗄️ **Backend Integration** — Uses Supabase for backend functionality.

---

## 🚀 How It Works

1. **Open CodeBridge** in a web browser on your device.
2. **Create or join a room** using a room code.
3. **Connect another device** using the appropriate room code.
4. **Share code or files** between the connected devices.
5. **Access your shared content** through the platform.

The goal is to make moving code and files between devices easier without relying on a complicated setup.

---

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| TypeScript | Type-safe application development |
| Node.js | Server-side JavaScript runtime |
| Supabase | Backend services and database integration |
| Google Cloud Run | Application deployment |
| Git | Version control |
| GitHub | Source code hosting |

---

## 🌐 Live Demo

**Try CodeBridge:** [Add your live application URL here]

Replace the placeholder above with your actual Google Cloud Run application URL.

---

## 💻 Getting Started

Follow these steps if you want to run the project locally.

### Prerequisites

Install the following:

- Node.js and npm
- Git
- A code editor such as Visual Studio Code
- Supabase credentials for the backend configuration

### 1. Clone the repository

```bash
git clone https://github.com/NiranjanBuilds18/CodeBridge.git
```

### 2. Open the project folder

```bash
cd CodeBridge
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a local `.env` file based on the provided `.env.example` file, if required by the project.

Add the appropriate configuration values for your environment.

Typical server-side configuration may include:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=codebridge-files
```

**Important:**
- Replace the example values with your own valid configuration.
- Never commit your `.env` file to GitHub.
- Never expose your Supabase service-role key in frontend code.
- Keep privileged credentials in server-side environment variables or a secure secrets manager.
- Only configure variables that your actual project requires.

### 5. Run the application

Install the dependencies and check the available scripts in `package.json`.

Use the appropriate development or start command defined by your project.

For example, if the corresponding script exists:

```bash
npm run dev
```

The exact command depends on how the project is configured.

---

## 🔐 Security

CodeBridge uses room-code-based pairing to connect devices.

Security practices to follow include:

- Keep privileged API keys on the server.
- Use appropriate Supabase database access policies.
- Protect file storage using suitable access controls.
- Avoid publishing secrets, private credentials, or sensitive information.
- Configure room access and file permissions appropriately.

**Note:** Room codes alone do not guarantee security. Actual protection depends on the application's implementation, database policies, and storage permissions.

---

## 🎯 Project Goals

CodeBridge was created to explore a practical solution to a common problem: moving code and files between devices.

The project brings together frontend development, backend integration, cloud deployment, and version control in one working application.

It also serves as a learning experience in building and deploying a web platform.

---

## 🔮 Future Improvements

Potential areas for further development include:

- Improved room management.
- Enhanced file-sharing controls.
- Better handling of large file transfers.
- Additional security and access-control improvements.
- Further interface and usability enhancements.

These are possible future improvements, not claims about existing features.

---

## 👨‍💻 Author

**Niranjan**

Electronics and Communication Engineering Student | Technology Enthusiast | Developer in Progress

GitHub: [@NiranjanBuilds18](https://github.com/NiranjanBuilds18)

---

## ⭐ Support

If you find this project interesting, consider giving the repository a star on GitHub.

Built with curiosity, experimentation, and a passion for learning by building.

**From an idea to a deployed platform. 🚀**
