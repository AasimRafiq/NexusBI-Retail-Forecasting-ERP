# NexusBI — Retail ERP, Demand Forecasting & Margin Engine

An enterprise retail Point-of-Sale (POS) and Business Intelligence web application combining real-time inventory accounting, ABC Pareto SKU classification, and Ordinary Least Squares (OLS) linear regression for 7-day revenue forecasting.

## Core Modules
- **Executive BI & OLS Demand Forecasting:** Computes 14-day revenue trends and applies Ordinary Least Squares (`y = mx + b`) regression to project 7-day future sales.
- **ABC Pareto Inventory Classification:** Automatically segments SKUs into Class A (top 70% revenue), Class B (next 20%), and Class C (bottom 10%) with automated reorder alerts.
- **POS Checkout Terminal:** Barcode/SKU lookup, dynamic discount and tax computation, and atomic stock deduction.
- **AI Financial & Stock Copilot:** Natural-language query engine for profit margins, dead-stock detection, and reorder planning.
- **Immutable Audit Ledger & CSV Export:** Full COGS and net profit tracking with one-click financial report export.
