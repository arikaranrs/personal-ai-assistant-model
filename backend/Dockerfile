# Use the exact Python version we just set up locally
FROM python:3.10

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file first (this makes future builds faster)
COPY requirements.txt .

# Upgrade pip and install all your heavy dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend files into the container
COPY . .

# Expose the mandatory Hugging Face port
EXPOSE 7860

# The command to start your backend
CMD ["python", "app.py"]