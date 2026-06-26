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

  function closestControlContainer(element) {
    var node = element;

    while (node && node !== document.body) {
      if (String(node.className || "").indexOf("ControlContainer") !== -1) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  function fieldLabelText(input) {
    var container = closestControlContainer(input);
    var label = container && container.querySelector("[class*='FieldLabel'], label");

    return label ? String(label.textContent || "").trim().toLowerCase() : "";
  }

  function imageComponentInputs(shortcode) {
    var inputs = Array.prototype.slice.call(shortcode.querySelectorAll("input"));
    var imageInput = null;
    var altInput = null;

    inputs.forEach(function (input, index) {
      var label = fieldLabelText(input);

      if (!imageInput && (label === "image url" || label === "image")) {
        imageInput = input;
        return;
      }

      if (!altInput && label.indexOf("alt text") === 0) {
        altInput = input;
        return;
      }

      if (!imageInput && index === 0) {
        imageInput = input;
      } else if (!altInput && index === 1) {
        altInput = input;
      }
    });

    return {
      image: imageInput,
      alt: altInput,
    };
  }

  function updateImageComponentPreview(shortcode) {
    var fields = imageComponentInputs(shortcode);
    var src = fields.image ? String(fields.image.value || "").trim() : "";
    var alt = fields.alt ? String(fields.alt.value || "").trim() : "";
    var existing = shortcode.querySelector(".decap-inline-image-preview");

    if (!src) {
      if (existing) {
        existing.parentElement.removeChild(existing);
      }

      shortcode.removeAttribute("data-inline-image-preview");
      return;
    }

    var wrapper = existing || document.createElement("figure");
    var image = wrapper.querySelector("img");

    if (!existing) {
      wrapper.className = "decap-inline-image-preview";
      image = document.createElement("img");
      wrapper.appendChild(image);
    }

    image.src = src;
    image.alt = alt;

    if (!existing) {
      var panel = shortcode.querySelector("[class*='ControlContainer-ShortcodeElement']") || shortcode;
      panel.insertBefore(wrapper, panel.firstChild);
    }

    shortcode.setAttribute("data-inline-image-preview", "true");
  }

  function updateImageComponentPreviews(root) {
    var scope = root || document;
    var shortcodes = [];

    if (scope.matches && scope.matches(".slate-shortcode")) {
      shortcodes.push(scope);
    }

    shortcodes = shortcodes.concat(Array.prototype.slice.call(scope.querySelectorAll(".slate-shortcode")));

    shortcodes.forEach(function (shortcode) {
      updateImageComponentPreview(shortcode);
    });
  }

  function scheduleImageComponentPreviews(root) {
    if (scheduleImageComponentPreviews.frame) {
      window.cancelAnimationFrame(scheduleImageComponentPreviews.frame);
    }

    scheduleImageComponentPreviews.frame = window.requestAnimationFrame(function () {
      updateImageComponentPreviews(root || document);
    });
  }

  document.addEventListener("input", function (event) {
    var shortcode = event.target && event.target.closest && event.target.closest(".slate-shortcode");

    if (shortcode) {
      scheduleImageComponentPreviews(shortcode);
    }
  }, true);

  new MutationObserver(function () {
    scheduleImageComponentPreviews(document);
  }).observe(document.body, {
    childList: true,
    subtree: true,
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
