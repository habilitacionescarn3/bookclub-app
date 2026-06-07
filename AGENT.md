# BookClub Repository Guide

Welcome to the BookClub serverless book-sharing platform codebase. This guide details the overall architecture, tech stack, and primary developer workflows.

## 🌐 System Overview
BookClub is a serverless application enabling users to catalog their physical books, manage club collections, and share them with other members.
- **Frontend**: A single-page React application written in TypeScript.
- **Backend**: An AWS Lambda microservices architecture deployed using the Serverless Framework.
- **Infrastructure**: Configured both via Serverless YAML and Terraform IaC for DNS, SSL, S3 buckets, and DynamoDB.

## 🗂️ Project Structure
- `/bookclub-app/frontend/`: Frontend React codebase, assets, and UI tests.
- `/bookclub-app/backend/`: Backend AWS Lambda handler code, Bedrock integrations, and tests.
- `/bookclub-app/docs/`: In-depth specification and development guides.

## 🛠️ Root-Level CLI Command Reference

| Context | Purpose | Command |
|---------|---------|---------|
| **Backend** | Local Dev Server (port 4000) | `cd bookclub-app/backend && npm run dev` |
| **Backend** | Run Dev Server with Seeded Data | `cd bookclub-app/backend && npm run dev:seed` |
| **Backend** | Run Unit Tests | `cd bookclub-app/backend && npm test` |
| **Backend** | Deploy to AWS (dev stage) | `cd bookclub-app/backend && npm run deploy:dev` |
| **Frontend** | Start Local Web Server (port 3000) | `cd bookclub-app/frontend && npm start` |
| **Frontend** | Run Unit Tests | `cd bookclub-app/frontend && npm test` |
| **Frontend** | Run Code Linting | `cd bookclub-app/frontend && npm run lint` |
| **Automation** | Deploy Dev Backend + Frontend S3 | `cd bookclub-app && ./deploy-dev.sh` |

## 📉 Technical Debt & Migration Plans
- **Auth Local Mocking**: In local development (`offline` / `dev` scripts), authentication is bypassed and simulated via mock users. Always verify that real AWS Cognito flows work in staging (`dev` branch) before deploying to production.
- **Local Database Mocking**: Local runs write books data to JSON files in `backend/.local-storage/`. Do not commit this folder to version control.
