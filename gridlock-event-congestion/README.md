# Gridlock Event Congestion Prototype

This project is a Round 2 prototype for the Flipkart Gridlock hackathon.
It separates model research, backend APIs, and frontend visualization into a clean, scalable structure.

## Repository Structure

- `data/` - raw and processed datasets (not checked in)
- `notebooks/` - Jupyter notebooks for exploration, OSMnx routing, and model training
- `backend/` - FastAPI server, ML model storage, and business logic
- `frontend/` - Streamlit dashboard for visualization and recommendations
- `scripts/` - utility scripts for data downloads and graph precomputation

## Setup

1. Create and activate a Python virtual environment.
2. Install backend and frontend dependencies.
3. Run `uvicorn backend.app.main:app --reload` for backend.
4. Run `streamlit run frontend/app.py` for frontend.
