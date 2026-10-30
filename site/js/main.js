document.addEventListener("DOMContentLoaded", () => {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((a) => {
    if (a.getAttribute("href") === current) a.classList.add("active");
  });
});
