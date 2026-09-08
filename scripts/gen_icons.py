from PIL import Image

src = Image.open("apps/web/public/logo.jpg").convert("RGBA")
BLUE = (29, 78, 216, 255)

for size in (192, 512):
    img = Image.new("RGBA", (size, size), BLUE)
    s = int(size * 0.72)
    logo = src.resize((s, s))
    img.paste(logo, ((size - s) // 2, (size - s) // 2), logo)
    img.save(f"apps/web/public/icon-{size}.png")

    img2 = Image.new("RGBA", (size, size), BLUE)
    s2 = int(size * 0.60)
    logo2 = src.resize((s2, s2))
    img2.paste(logo2, ((size - s2) // 2, (size - s2) // 2), logo2)
    img2.save(f"apps/web/public/icon-{size}-maskable.png")

print("icons written")
