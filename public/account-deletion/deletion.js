const form = document.getElementById("deletion-form");
const status = document.getElementById("status");
document.getElementById("year").textContent = new Date().getFullYear();

async function request(url, options) {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "omit" });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(payload.message || "Request failed. Please try again.");
  return payload;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!window.confirm("Permanently delete your FinTrack account and financial records? This cannot be undone.")) return;
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Verifying your credentials…";
  let token;
  try {
    const login = await request("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.elements.email.value.trim(), password: form.elements.password.value }),
    });
    token = login.data.token; // Memory only: never cookies, URLs or local storage.
    status.textContent = "Deleting your account…";
    await request("/api/auth/me", {
      method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: form.elements.password.value, confirmation: form.elements.confirmation.value }),
    });
    form.reset();
    form.hidden = true;
    status.textContent = "Your account and associated records were deleted from the active database. Sign out on other devices to clear their local caches.";
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? "We could not confirm completion. Check your connection. If deletion was already processed, signing in again will fail."
      : error.message;
  } finally {
    token = undefined;
    form.elements.password.value = "";
    button.disabled = false;
    status.focus();
  }
});
