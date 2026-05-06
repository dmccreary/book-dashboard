// Bootstrap loader for the Book Progress Dashboard.
//
// Reads three static JSON files at startup:
//   workflow-steps.json         — DAG of build steps shared across all books (constants + step definitions)
//   ../book-data/books.json     — manifest: list of available books for the selector
//   ../book-data/<book>.json    — per-book status (the book selected via ?book=<slug>, default: gen-ai-book-status)
//
// On success it sets:
//   window.PROJECT, window.STATUS_WEIGHT, window.STATUS_META, window.SECTIONS,
//   window.WORKFLOW, window.BOOKS, window.CURRENT_BOOK
//
// app.jsx awaits window.DATA_READY before mounting React so the rest of the
// codebase keeps reading the same globals it always did.

(function () {
  const params = new URLSearchParams(window.location.search);
  const book = params.get("book") || "gen-ai-book-status";

  function buildSection(step, bookStep) {
    const base = {
      id: step.id,
      name: step.name,
      short: step.short,
      description: step.description,
    };
    if (step.childIdPrefix) {
      const children = (bookStep && bookStep.children) || [];
      return {
        ...base,
        countLabel: bookStep && bookStep.countLabel,
        children: children.map(c => ({ id: `${step.childIdPrefix}-${c.n}`, ...c })),
      };
    }
    return {
      ...base,
      status: (bookStep && bookStep.status) || "not-started",
      tokensTarget: (bookStep && bookStep.tokensTarget) || 0,
      tokensDone: (bookStep && bookStep.tokensDone) || 0,
    };
  }

  window.DATA_READY = (async () => {
    const [workflow, books, status] = await Promise.all([
      fetch("workflow-steps.json").then(r => r.json()),
      fetch("../book-data/books.json").then(r => r.json()),
      fetch(`../book-data/${book}.json`).then(r => r.json()),
    ]);

    window.WORKFLOW = workflow;
    window.BOOKS = books;
    window.CURRENT_BOOK = book;
    window.PROJECT = status.project;
    window.STATUS_WEIGHT = workflow.constants.statusWeight;
    window.STATUS_META = workflow.constants.statusMeta;
    window.SECTIONS = workflow.steps.map(step =>
      buildSection(step, status.sections && status.sections[step.id])
    );
  })();
})();
