# Use slim Python for small image size
FROM python:3.11-slim

# Install system dependencies (optional but common)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements separately for caching
COPY requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py /app

# Expose FastAPI port
EXPOSE 8000

# Start the FastAPI server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
