const searchInput = document.getElementById("project-search");
const searchSummary = document.getElementById("search-summary");
const projectCards = Array.from(document.querySelectorAll("[data-project-card]"));
const emptyState = document.getElementById("empty-state");

if (searchInput && searchSummary && emptyState) {
  const updateProjectFilter = () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    projectCards.forEach((card) => {
      const matches = card.textContent.toLowerCase().includes(query);
      card.hidden = !matches;

      if (matches) {
        visibleCount += 1;
      }
    });

    if (!query) {
      emptyState.hidden = true;
      searchSummary.textContent = "Showing all community project spaces.";
      return;
    }

    emptyState.hidden = visibleCount !== 0;
    searchSummary.textContent = `Showing ${visibleCount} project${visibleCount === 1 ? "" : "s"} for “${query}”.`;
  };

  searchInput.addEventListener("input", updateProjectFilter);
}
