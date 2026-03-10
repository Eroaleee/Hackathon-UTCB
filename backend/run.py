import uvicorn
from app.database import init_db

if __name__ == "__main__":
    init_db()
    print("✅ Database initialized")
    print("🚀 Starting Masterplan Velo API on http://localhost:8000")
    print("📖 Swagger docs at http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
