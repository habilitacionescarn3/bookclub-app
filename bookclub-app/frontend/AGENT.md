# BookClub Frontend Developer Guide

This document defines frontend development standards, UI design constraints, and testing protocols.

## 🎨 UI & Styling Design System
- **Framework**: React 19 + TypeScript.
- **Styling**: Tailwind CSS (version 3.x). Utility-first classes are used for responsive styling.
- **Interactive UI**: Headless UI (`@headlessui/react`) and Heroicons (`@heroicons/react`) for accessible components and icons.
- **Aesthetic Guidelines**: Smooth transitions (e.g., `transition-all duration-300`), modern card layouts, subtle gradients, and dark-mode compatibility where specified.

## 🗄️ Directory Architecture
- `src/components/`: Reusable UI blocks (modals, cards, forms, loaders).
- `src/pages/`: Page-level components corresponding to React Router routes (e.g., LibraryHub, BookDetails).
- `src/contexts/`: React context providers (e.g., auth contexts, UI themes).
- `src/services/`: API client classes and network adapters (Axios instance configured with base URLs).
- `src/types/`: Shared TypeScript interface definitions (e.g., Book, Listing, User).

## ⚡ Core CLI Commands
- `npm start`: Starts the local React development server at `http://localhost:3000`.
- `npm run build`: Bundles the React app for production deployment (using target configuration from `scripts/build.js`).
- `npm test`: Runs Jest tests interactively.
- `npm run lint`: Performs lint checks over the codebase to enforce code quality.
- `npm run test:coverage`: Executes tests and produces a code coverage summary.

## 🧪 Frontend Test Strategy
- **Framework**: Jest with `@testing-library/react` and `@testing-library/jest-dom`.
- **Mocking**: Axios calls must be mocked using `axios-mock-adapter` or custom Jest mocks. Avoid calling real backend APIs during testing.
- **Coverage Rules**: Maintain statements and branch coverage requirements configured in `package.json`.
