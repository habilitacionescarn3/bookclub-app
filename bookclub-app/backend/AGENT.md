# BookClub Backend Developer Guide

This document details serverless operations, AWS Lambda handlers, API layouts, data models, and local simulation protocols.

## ☁️ Serverless & Microservice Architecture
- **Framework**: Serverless Framework v3.
- **Runtime**: Node.js runtime (CommonJS module system).
- **Environment Isolation**: Configured stage parameter (`dev` / `prod`) dictates separate AWS DynamoDB, Cognito, and S3 resources.

## 🗄️ Database & Storage Models
- **DynamoDB**: Managed via AWS SDK. Primary entities:
  - Users: Managed via Cognito and synchronized with DB.
  - Books: Details physical books uploaded by users.
  - Listings: Books marked for exchange, loan, or sharing.
- **Local Simulation**: In offline mode, DynamoDB operations are intercepted and redirected to disk writes under `.local-storage/` to enable zero-credential local development.

## 🚀 Key Integrations & Workers
- **OCR Engine**: Tesseract.js (frontend) and node-sharp based workers on backend for processing uploaded book images.
- **AI Integration**: AWS Bedrock Runtime (`@aws-sdk/client-bedrock-runtime`) for parsing book metadata, authors, and summaries from covers.
- **Dead Letter Queue (DLQ)**: Failed AI integrations route messages to a Bedrock DLQ. Replay script: `npm run replay:bedrock-dlq`.

## ⚡ Core CLI Commands
- `npm run dev`: Starts Serverless Offline local emulation on port `4000`.
- `npm run dev:seed`: Seeds initial mock data (books, listings) to `.local-storage/` and starts the offline server.
- `npm run seed`: Seeds offline data without booting the server.
- `npm run deploy`: Deploys current Lambda configurations to AWS.
- `npm test`: Runs Jest tests on handlers and database models.

## 🧪 Test Strategy
- **Integration Tests**: Supertest is utilized to perform request/response assertions on routes.
- **Mocking**: AWS SDK operations are mocked when running unit tests to ensure quick execution without AWS network calls.
