import os
from PIL import Image, ImageDraw, ImageFont

def create_text_image(filename, lines, size=(800, 1000)):
    # Create white canvas
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to load a standard layout font, default to default otherwise
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except IOError:
        font = ImageFont.load_default()
        
    y_offset = 50
    for line in lines:
        draw.text((50, y_offset), line, fill='black', font=font)
        y_offset += 50
        
    img.save(filename)
    print(f"Generated {filename}")

if __name__ == "__main__":
    os.makedirs("test_fixtures", exist_ok=True)
    
    qp_lines = [
        "--- MIDTERM EXAM ---",
        "",
        "Q1. Explain the differences between supervised and unsupervised learning. [5 marks]",
        "Q2. Explain what is a convolution layer in CNN and why it is parameter-efficient. [10m]",
        "Q3(a). What is SGD optimizer? [3]",
        "Q3(b). Compare ReLU and GELU activation functions. [4 marks]",
        "",
        "--- END OF QUESTION PAPER ---"
    ]
    
    as_lines = [
        "--- STUDENT SHEET ---",
        "",
        "Ans 1. Supervised learning requires labeled dataset input, where each",
        "example has a target output. Unsupervised learning identifies hidden",
        "patterns in unlabeled data, for instance clustering similar attributes.",
        "",
        "",
        "Ans 3(a). SGD stands for Stochastic Gradient Descent. It computes the gradient",
        "and updates parameters using a single random sample per iteration,",
        "which makes updates faster and less memory-intensive.",
        "",
        "",
        "Ans 2. A convolution layer slides filters over inputs to construct local feature maps.",
        "It is parameter-efficient because weights are shared (weight sharing) and",
        "neurons are only locally connected, reducing parameters compared to dense layers.",
        "",
        "",
        "Random notes about activation functions like Sigmoid being saturated.",
        "This is an orphan block."
    ]
    
    create_text_image("test_fixtures/qp_test.png", qp_lines)
    create_text_image("test_fixtures/as_test.png", as_lines)
