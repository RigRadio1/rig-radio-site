const modal = document.getElementById("editProfileModal");
const openBtn = document.getElementById("openEditProfile");
const closeBtn = document.getElementById("closeEditProfile");
const cancelBtn = document.getElementById("cancelEditProfile");
const backdrop = document.getElementById("closeEditProfileBackdrop");

function openEditProfile() {
  modal?.classList.add("is-open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEditProfile() {
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

openBtn?.addEventListener("click", openEditProfile);
closeBtn?.addEventListener("click", closeEditProfile);
cancelBtn?.addEventListener("click", closeEditProfile);
backdrop?.addEventListener("click", closeEditProfile);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditProfile();
});
