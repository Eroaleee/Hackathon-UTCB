import uvicorn

if __name__ == "__main__":
    print("🤖 Starting Velo AI Engine on http://localhost:8001")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=False)
