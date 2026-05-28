(function () {
  const links = [...document.querySelectorAll('a[href*="/presentations/"],a[href*="/session/"]')]
    .filter(a => !a.querySelector('img') && a.textContent.trim().length > 0);

  if (!links.length) {
    alert("No talk links found on this page.");
    return;
  }

  const talks = links.map((a, i) => {
    let timeText = "Not found";
    let roomText = "Not found";
    let topicsText = "";
    let currentEl = a;

    for (let d = 0; d < 12 && currentEl; d++) {
      const txt = currentEl.innerText || "";
      const tM = txt.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      const rM = txt.match(/Room:\s*([^\n\r]+)/i);
      const tpM = txt.match(/Topics:\s*([^\n\r]+)/i);

      if (tM && timeText === "Not found") timeText = tM[1];
      if (rM && roomText === "Not found") roomText = rM[1].trim();
      if (tpM && !topicsText) topicsText = tpM[1].trim();

      if (timeText !== "Not found" && roomText !== "Not found" && topicsText) break;
      currentEl = currentEl.parentElement;
    }

    return {
      id: i,
      title: a.textContent.trim(),
      url: a.href,
      time: timeText,
      room: roomText,
      topics: topicsText,
      desc: "Loading description...",
      speaker: "Loading speaker...",
      speakerInfo: ""
    };
  });

  let currentIdx = 0;
  const starred = new Set(JSON.parse(localStorage.getItem("osn_starred") || "[]"));
  let currentView = "all";

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "#fff",
    color: "#111",
    zIndex: "999999",
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui,sans-serif",
    boxSizing: "border-box"
  });
  document.body.appendChild(modal);

  async function fetchTalkDetails(t) {
    try {
      const res = await fetch(t.url);
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      const mainContent =
        doc.querySelector(".presentation-description,.session-description,article,.content,main") ||
        doc.body;

      const speakerEls = [...doc.querySelectorAll(".speaker-name,.speaker-profile h3,.speaker-profile h4,h3,h4")]
        .map(el => el.textContent.trim())
        .filter(x => x.length > 0 && x.length < 50);

      t.speaker = [...new Set(speakerEls)].slice(0, 4).join(", ") || "Not specified";

      const contentTexts = [];
      mainContent.querySelectorAll("p,li,div.description-text").forEach(p => {
        const tx = p.textContent.trim();
        if (tx.length > 15 && !contentTexts.includes(tx)) contentTexts.push(tx);
      });

      if (contentTexts.length > 1) {
        t.desc = contentTexts.slice(0, Math.ceil(contentTexts.length / 2)).join("<br><br>");
        t.speakerInfo = contentTexts.slice(Math.ceil(contentTexts.length / 2)).join("<br><br>");
      } else {
        t.desc = mainContent.innerHTML;
        t.speakerInfo = "";
      }

      if (currentView !== "agenda") render();
    } catch (e) {
      t.desc = "Failed to fetch details.";
      t.speaker = "Error";
      if (currentView !== "agenda") render();
    }
  }

  talks.forEach(fetchTalkDetails);

  function render() {
    if (currentView === "agenda") {
      renderAgendaView();
      return;
    }

    const visibleTalks = currentView === "starred"
      ? talks.filter(t => starred.has(t.id))
      : talks;

    if (visibleTalks.length === 0) {
      modal.innerHTML = `
        <div style="text-align:center;margin-top:100px;">
          <h3>No starred talks found!</h3>
          <button id="osn-toggle" style="padding:10px 20px;cursor:pointer;background:#222;color:#fff;border:none;border-radius:4px;font-size:16px;">
            Show All Talks
          </button>
        </div>
      `;
      modal.querySelector("#osn-toggle").onclick = () => {
        currentView = "all";
        currentIdx = 0;
        render();
      };
      return;
    }

    if (currentIdx >= visibleTalks.length) currentIdx = visibleTalks.length - 1;
    if (currentIdx < 0) currentIdx = 0;

    const talk = visibleTalks[currentIdx];
    const isStarred = starred.has(talk.id);

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eee;padding-bottom:15px;margin-bottom:20px;">
        <span style="font-size:15px;font-weight:bold;color:#555;">
          Talk ${currentIdx + 1} of ${visibleTalks.length}${currentView === "starred" ? " (Starred Mode)" : ""}
        </span>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="osn-agenda" style="background:#007bff;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">
            View Agenda (${starred.size})
          </button>
          <button id="osn-filter" style="background:#f4f4f4;border:1px solid #aaa;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">
            ${currentView === "starred" ? "Show All" : "Filter Starred"}
          </button>
          <button id="osn-close" style="background:none;border:none;font-size:32px;cursor:pointer;line-height:1;padding:0 5px;">
            &times;
          </button>
        </div>
      </div>

      <div style="flex:1;overflow-y:auto;padding-right:15px;font-size:16px;line-height:1.5;max-width:1000px;margin:0 auto;width:100%;box-sizing:border-box;">
        <h1 style="margin:0 0 10px 0;font-size:32px;color:#000;font-weight:800;line-height:1.2;">
          ${talk.title}
        </h1>

        <div style="margin-bottom:12px;font-size:18px;color:#222;">
          <strong style="color:#000;">Speaker(s):</strong> ${talk.speaker}
        </div>
    `;

    if (talk.topics) {
      html += `
        <div style="margin-bottom:12px;color:#444;">
          <strong style="color:#000;">Topics:</strong> ${talk.topics}
        </div>
      `;
    }

    html += `
        <div style="margin-bottom:20px;font-size:16px;color:#444;background:#f8f9fa;padding:12px;border-radius:6px;border-left:4px solid #007bff;">
          <span style="margin-right:20px;"><strong style="color:#000;">Time:</strong> ${talk.time}</span>
          <span><strong style="color:#000;">Room:</strong> ${talk.room}</span>
        </div>

        <div style="margin-bottom:25px;border-top:1px solid #ddd;padding-top:15px;">
          <h3 style="margin:0 0 10px 0;font-size:16px;color:#000;text-transform:uppercase;letter-spacing:0.5px;">
            Talk Description
          </h3>
          <div style="color:#333;">${talk.desc}</div>
        </div>
    `;

    if (talk.speakerInfo) {
      html += `
        <div style="margin-bottom:20px;border-top:1px solid #ddd;padding-top:15px;">
          <h3 style="margin:0 0 10px 0;font-size:16px;color:#000;text-transform:uppercase;letter-spacing:0.5px;">
            Speaker Bio & Details
          </h3>
          <div style="color:#555;font-style:italic;">${talk.speakerInfo}</div>
        </div>
      `;
    }

    html += `
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #eee;padding-top:15px;margin-top:15px;max-width:1000px;margin-left:auto;margin-right:auto;width:100%;">
        <button id="osn-prev" ${currentIdx === 0 ? "disabled" : ""} style="padding:10px 24px;cursor:pointer;border-radius:4px;border:1px solid #bbb;background:#fff;font-size:15px;opacity:${currentIdx === 0 ? 0.4 : 1};">
          &larr; Prev
        </button>

        <button id="osn-star" style="padding:10px 30px;cursor:pointer;border-radius:4px;border:1px solid ${isStarred ? "#d97706" : "#ccc"};background:${isStarred ? "#fffbeb" : "#fff"};color:${isStarred ? "#b45309" : "#333"};font-weight:bold;font-size:15px;">
          ${isStarred ? "★ Starred" : "☆ Star Talk"}
        </button>

        <button id="osn-next" ${currentIdx === visibleTalks.length - 1 ? "disabled" : ""} style="padding:10px 24px;cursor:pointer;border-radius:4px;border:1px solid #bbb;background:#fff;font-size:15px;opacity:${currentIdx === visibleTalks.length - 1 ? 0.4 : 1};">
          Next &rarr;
        </button>
      </div>
    `;

    modal.innerHTML = html;

    modal.querySelector("#osn-close").onclick = () => modal.remove();
    modal.querySelector("#osn-prev").onclick = () => {
      if (currentIdx > 0) {
        currentIdx--;
        render();
      }
    };
    modal.querySelector("#osn-next").onclick = () => {
      if (currentIdx + 1 < visibleTalks.length) {
        currentIdx++;
        render();
      }
    };
    modal.querySelector("#osn-agenda").onclick = () => {
      currentView = "agenda";
      render();
    };
    modal.querySelector("#osn-filter").onclick = () => {
      currentView = currentView === "starred" ? "all" : "starred";
      currentIdx = 0;
      render();
    };
    modal.querySelector("#osn-star").onclick = () => {
      if (starred.has(talk.id)) {
        starred.delete(talk.id);
      } else {
        starred.add(talk.id);
      }
      localStorage.setItem("osn_starred", JSON.stringify([...starred]));
      render();
    };
  }

  function renderAgendaView() {
    const starredTalks = talks.filter(t => starred.has(t.id));
    const grouped = {};

    starredTalks.forEach(t => {
      const tk = t.time || "Unknown Time";
      if (!grouped[tk]) grouped[tk] = [];
      grouped[tk].push(t);
    });

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #eee;padding-bottom:15px;margin-bottom:20px;">
        <span style="font-size:18px;font-weight:bold;color:#111;">
          My Starred Agenda (${starredTalks.length})
        </span>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="osn-back" style="background:#6c757d;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">
            &larr; Back to Slides
          </button>
          <button id="osn-close" style="background:none;border:none;font-size:32px;cursor:pointer;line-height:1;padding:0 5px;">
            &times;
          </button>
        </div>
      </div>

      <div id="agenda-content" style="flex:1;overflow-y:auto;padding-right:15px;max-width:1000px;margin:0 auto;width:100%;box-sizing:border-box;"></div>
    `;

    modal.querySelector("#osn-close").onclick = () => modal.remove();
    modal.querySelector("#osn-back").onclick = () => {
      currentView = "all";
      currentIdx = 0;
      render();
    };

    const container = modal.querySelector("#agenda-content");

    if (starredTalks.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#666;margin-top:50px;">You haven't starred any talks yet!</p>`;
      return;
    }

    const sortedTimes = Object.keys(grouped).sort((a, b) => {
      const mA = a.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const mB = b.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!mA || !mB) return 0;

      let hA = parseInt(mA[1]);
      let hB = parseInt(mB[1]);

      if (mA[3].toUpperCase() === "PM" && hA < 12) hA += 12;
      if (mA[3].toUpperCase() === "AM" && hA === 12) hA = 0;
      if (mB[3].toUpperCase() === "PM" && hB < 12) hB += 12;
      if (mB[3].toUpperCase() === "AM" && hB === 12) hB = 0;

      return (hA * 60 + parseInt(mA[2])) - (hB * 60 + parseInt(mB[2]));
    });

    sortedTimes.forEach(time => {
      const timeHeader = document.createElement("div");
      Object.assign(timeHeader.style, {
        fontSize: "20px",
        fontWeight: "bold",
        color: "#007bff",
        backgroundColor: "#f0f7ff",
        padding: "8px 15px",
        borderRadius: "6px",
        marginTop: "20px",
        marginBottom: "10px",
        borderLeft: "5px solid #007bff"
      });
      timeHeader.textContent = time;
      container.appendChild(timeHeader);

      grouped[time].forEach(talk => {
        const item = document.createElement("div");
        Object.assign(item.style, {
          padding: "12px 15px",
          borderBottom: "1px solid #eee",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        });

        let inner = `
          <div style="font-size:16px;font-weight:bold;color:#000;">${talk.title}</div>
          <div style="font-size:14px;color:#444;">
            <span style="margin-right:15px;"><strong>Room:</strong> ${talk.room}</span>
        `;

        if (talk.topics) {
          inner += `<span><strong>Topics:</strong> ${talk.topics}</span>`;
        }

        inner += `</div>`;
        item.innerHTML = inner;
        container.appendChild(item);
      });
    });
  }

  render();
})();
