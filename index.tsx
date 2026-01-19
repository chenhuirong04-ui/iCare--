<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>iCare</title>

    <!-- Tailwind CDN（你现在用的是这个，先不动） -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Google Fonts（可有可无，保留） -->
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>

  <body>
    <div id="root"></div>

    <!-- 🔴 关键：Vite 构建入口（之前缺的就是这一行） -->
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
