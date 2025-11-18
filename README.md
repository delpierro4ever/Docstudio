# Student Report Formatter

Student Report Formatter is a tool that automatically formats student reports/theses
according to predefined academic standards.

## Core Features (Target)

- Upload a .docx report
- Automatically:
  - Separate preliminaries and main content
  - Apply correct page numbering (Roman for prelims, Arabic for main body)
  - Set fonts and spacing (e.g., Times New Roman, size 12, 1.5 spacing)
  - Generate Table of Contents, List of Tables, List of Figures
  - Place abbreviations and meanings in a clean table
  - Format references in the chosen style

## Modules

1. Project Foundations (Git, structure, docs)
2. Formatting Rules Engine
3. Document Ingestion (upload & type detection)
4. Document Formatter Service (.docx in, .docx out)
5. Web Interface (upload + download)
6. User Accounts & Auth
7. Usage Limits & Billing
8. Admin & Analytics
9. Deployment

## Tech Stack (Draft)

- Frontend: Next.js (React)
- Backend: Node.js/TypeScript (or separate microservice if needed)
- Storage: (TBD) – local in dev, cloud in production
