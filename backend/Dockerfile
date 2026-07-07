# Deterministic build for Railway (and any container host).
# Using a Dockerfile makes Railway skip Nixpacks/Railpack version detection.
FROM python:3.11-slim

# Faster, cleaner Python in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so this layer caches across code changes.
# psycopg2-binary, pillow, bcrypt, cryptography all ship manylinux wheels,
# so no system build tools are needed on python:3.11-slim.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the application code.
COPY . .

# Railway injects $PORT at runtime; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
