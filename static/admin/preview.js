(function () {
  function getData(entry, key) {
    return entry.getIn(["data", key]);
  }

  function toArray(value) {
    if (!value) {
      return [];
    }

    if (typeof value.toJS === "function") {
      return value.toJS();
    }

    return Array.isArray(value) ? value : [value];
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function compact(children) {
    return children.filter(function (child) {
      return child !== null && child !== undefined && child !== false;
    });
  }

  function categories(entry) {
    return toArray(getData(entry, "categories")).map(function (item) {
      return typeof item === "string" ? item : item.category;
    }).filter(Boolean);
  }

  if (!window.CMS) {
    return;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function markdownAlt(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
  }

  window.CMS.registerEditorComponent({
    id: "image",
    label: "Image",
    collapsed: false,
    fields: [
      { label: "Image URL", name: "image", widget: "string" },
      { label: "Alt text", name: "alt", widget: "string", required: false },
    ],
    pattern: /^!\[(.*?)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/m,
    fromBlock: function (match) {
      return {
        alt: match[1] || "",
        image: match[2] || "",
      };
    },
    toBlock: function (data) {
      var src = String(data.image || data.src || "").trim();

      if (!src) {
        return "";
      }

      return "![" + markdownAlt(data.alt) + "](" + src + ")";
    },
    toPreview: function (data) {
      var src = String(data.image || data.src || "").trim();

      if (!src) {
        return "";
      }

      return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(data.alt) + '">';
    },
  });

  window.CMS.registerPreviewStyle("/admin/preview.css");

  var h = window.h;
  var createClass = window.createClass;

  if (!h || !createClass) {
    return;
  }

  var PostPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var title = getData(entry, "title") || "Untitled";
      var date = formatDate(getData(entry, "date"));
      var draft = getData(entry, "draft");
      var link = getData(entry, "link");
      var author = getData(entry, "author");
      var cats = categories(entry);
      var hasMeta = date || draft || link || author;

      return h("main", { className: "decap-preview content" }, compact([
        h("header", {}, [
          h("div", { className: "main" }, [
            h("a", { href: "https://arjenzhou.com/" }, "arjenzhou"),
          ]),
          h("nav", {}, [
            h("a", { href: "https://arjenzhou.com/article" }, "Article"),
            h("a", { href: "https://arjenzhou.com/translation" }, "Translation"),
            h("a", { href: "https://arjenzhou.com/reproduction" }, "Reproduction"),
            h("a", { href: "https://arjenzhou.com/categories" }, "Category"),
          ]),
        ]),
        h("article", {}, [
          h("div", { className: "title" }, compact([
            h("h1", { className: "title" }, title),
            author ? h("span", { className: "link" }, "by " + author) : null,
            hasMeta ? h("div", { className: "meta" }, compact([
              date ? "Posted on " + date : null,
              draft ? h("span", { className: "draft-label" }, "DRAFT") : null,
              link ? h("span", { className: "link" }, [
                " from ",
                h("a", { href: link }, link),
              ]) : null,
              h("hr", {}),
            ])) : null,
          ])),
          h("section", { className: "body" }, this.props.widgetFor("body")),
          cats.length ? h("div", { className: "post-tags" }, [
            h("nav", { className: "nav tags" }, [
              h("ul", { className: "tags" }, cats.map(function (cat) {
                return h("li", { key: cat }, [
                  h("a", { href: "https://arjenzhou.com/categories/" + encodeURIComponent(cat) }, cat),
                ]);
              })),
            ]),
          ]) : null,
        ]),
        h("footer", {}, "Preview approximates the Hugo article layout. Save to see the exact rendered page."),
      ]));
    },
  });

  [
    "article",
    "weekly",
    "translation",
    "reproduction",
    "pages",
    "home",
    "articles_index",
    "weeklies_index",
    "translations_index",
    "reproductions_index",
    "resume",
  ].forEach(function (name) {
    window.CMS.registerPreviewTemplate(name, PostPreview);
  });
})();
