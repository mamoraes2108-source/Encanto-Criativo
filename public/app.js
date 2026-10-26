const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const brl = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0,
  );
const day = (d) => (d ? d.split("-").reverse().join("/") : "—");
const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const pages = {
  painel: [
    "◫",
    "Painel inicial",
    "Um olhar para o seu negócio",
    "Cada detalhe organizado. Mais espaço para criar.",
  ],
  pedidos: [
    "▤",
    "Pedidos",
    "Pedidos feitos com carinho",
    "Acompanhe cada criação, do primeiro contato à entrega.",
  ],
  clientes: [
    "♧",
    "Clientes",
    "Pessoas que fazem parte",
    "Conexões especiais, histórias que continuam.",
  ],
  custos: [
    "◇",
    "Custos e preços",
    "Cada detalhe tem seu valor",
    "Custos organizados para criar com segurança.",
  ],
  orcamento: [
    "✧",
    "Simulador",
    "Transforme ideias em orçamento",
    "Planeje seus custos e encontre o valor da sua criação.",
  ],
  relatorios: [
    "▥",
    "Relatórios",
    "Resultados que inspiram",
    "Conheça os números por trás das suas criações.",
  ],
  importar: [
    "⇧",
    "Importar Excel",
    "Da planilha para o ateliê digital",
    "Confira os dados com calma, antes de confirmar.",
  ],
};
let data,
  route = "painel",
  range = { from: "", to: "", demo: "all" },
  importState = null;
async function api(path, body, method = "POST") {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? {}
      : {
          method,
          headers:
            body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  if (!r.ok) {
    const j = await r.json();
    throw Error(j.error || "Falha na operação.");
  }
  return r.json();
}
function notify(message, error = false) {
  $("#notice").className = error ? "error" : "success";
  $("#notice").textContent = message;
}
function modal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").showModal();
}
function bindForm(id, fn) {
  $(id).onsubmit = async (e) => {
    e.preventDefault();
    $("#notice").textContent = "";
    $("#notice").className = "";
    $("#form-error")?.remove();
    const b = e.submitter;
    b.disabled = true;
    try {
      await fn(new FormData(e.target));
    } catch (err) {
      let el = $("#form-error");
      if (!el) {
        el = document.createElement("div");
        el.id = "form-error";
        el.className = "error";
        e.target.prepend(el);
      }
      el.textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
}
const clientName = (id) =>
  data.clients.find((c) => c.id === id)?.name || "Cliente";
const active = () =>
  data.orders.filter(
    (o) =>
      o.demo !== true &&
      o.status !== "Cancelado" &&
      (!range.from || o.date >= range.from) &&
      (!range.to || o.date <= range.to),
  );
const sum = (rows, key) => rows.reduce((s, o) => s + Number(o[key] || 0), 0);
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
function filters() {
  const realOnly = ["", "#painel", "#relatorios"].includes(location.hash);
  return `<div class="filters"><label>De <input type="date" id="from" value="${range.from}" aria-label="Início do período"></label><label>Até <input type="date" id="to" value="${range.to}" aria-label="Fim do período"></label><select id="demo" aria-label="Origem dos dados">${realOnly ? '<option value="all">Somente pedidos reais</option>' : `<option value="all">Todos os dados</option><option value="demo" ${range.demo === "demo" ? "selected" : ""}>Só demonstração</option><option value="real" ${range.demo === "real" ? "selected" : ""}>Sem demonstração</option>`}</select></div>`;
}
function bindFilters() {
  ["from", "to", "demo"].forEach(
    (k) =>
      ($("#" + k).onchange = (e) => {
        range[k] = e.target.value;
        render();
      }),
  );
}
function cards(rows) {
  return `<div class="cards"><div class="card"><label>Faturamento do período</label><span class="icon">↗</span><strong>${brl(sum(rows, "total"))}</strong><small>Vendas registradas · exceto canceladas</small></div><div class="card rose"><label>Lucro bruto</label><span class="icon">✧</span><strong>${brl(sum(rows, "profit"))}</strong><small>Vendas menos custos registrados</small></div><div class="card"><label>Pedidos em aberto</label><span class="icon">▤</span><strong>${rows
    .filter((o) => o.status === "Aberto")
    .length.toString()
    .padStart(
      2,
      "0",
    )}</strong><small>Aguardando o próximo passo</small></div><div class="card rose"><label>Em produção</label><span class="icon">♧</span><strong>${rows
    .filter((o) => o.status === "Em produção")
    .length.toString()
    .padStart(
      2,
      "0",
    )}</strong><small>Ideias ganhando forma</small></div></div>`;
}
function ordersTable(rows) {
  return rows.length
    ? `<div class="table-wrap"><table><thead><tr><th>Cliente / criação</th><th>Entrega</th><th>Valor</th><th>Produção</th><th></th></tr></thead><tbody>${rows.map((o) => `<tr><td>${esc(clientName(o.clientId))}<small>${esc(o.theme || o.lines[0]?.name)} ${o.demo ? "· demonstração" : ""}</small></td><td>${day(o.delivery)}</td><td>${brl(o.total)}</td><td>${badge(o.status)}</td><td><button class="secondary" data-order="${o.id}">Ver</button></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">Nenhum pedido neste período.</div>';
}
function months(rows) {
  const map = new Map();
  rows.forEach((o) => {
    const k = o.date.slice(0, 7);
    const v = map.get(k) || { month: k, total: 0, profit: 0, quantity: 0 };
    v.total += o.total;
    v.profit += o.profit;
    v.quantity += o.quantity;
    map.set(k, v);
  });
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}
function chart(rows) {
  const values = months(rows).slice(-6);
  const max = Math.max(
    ...values.map((v) => Math.max(v.total, Math.abs(v.profit))),
    1,
  );
  return values.length
    ? `<div class="chart">${values.map((v) => `<div class="chart-col"><div class="bar-pair"><div class="bar" style="height:${Math.max((v.total / max) * 100, 1)}%" title="Venda: ${brl(v.total)}"></div><div class="bar profit" style="height:${Math.max((Math.abs(v.profit) / max) * 100, 1)}%" title="Lucro bruto: ${brl(v.profit)}"></div></div><small>${v.month.split("-").reverse().join("/")}</small></div>`).join("")}</div><p class="form-note">Passe sobre as barras para ver valores. Prejuízos aparecem em magnitude absoluta.</p>`
    : '<div class="empty">Sem vendas para exibir.</div>';
}
function v1Ranking(rows, type) {
  const map = new Map();
  for (const o of rows.filter((o) => o.demo !== true)) {
    if (type === "Coleção") {
      const key = o.collection || "Sem coleção";
      map.set(key, (map.get(key) || 0) + o.quantity);
    } else
      for (const l of o.lines.filter((l) => l.type === type))
        map.set(l.name, (map.get(l.name) || 0) + l.quantity);
  }
  return [...map].sort((a, b) => b[1] - a[1]);
}
function rank(rows, type) {
  const values = ranking(rows, type).slice(0, 5),
    max = Math.max(...values.map((v) => v[1]), 1);
  return values.length
    ? values
        .map(
          ([name, n]) =>
            `<div class="rank"><div><span>${esc(name)}</span><span>${n} peças</span></div><div class="track"><i style="width:${(n / max) * 100}%"></i></div></div>`,
        )
        .join("")
    : '<p class="subtle">Sem dados no período.</p>';
}
function v1Dashboard() {
  const rows = active();
  $("#content").innerHTML =
    `<div class="toolbar"><h2>Visão geral <span class="subtle">· seu ateliê em números</span></h2>${filters()}</div>${cards(rows)}<div class="grid2"><div class="panel"><div class="panel-head"><h2>Vendas & resultados</h2><div class="legend"><span><i class="dot"></i>Vendas</span><span><i class="dot pink"></i>Lucro bruto</span></div></div>${chart(rows)}</div><div class="panel"><div class="panel-head"><h2>Criações favoritas</h2><span class="subtle">por peças</span></div>${rank(rows, "Modelo")}</div></div><div class="grid2"><div class="panel"><div class="panel-head"><h2>Pedidos recentes</h2><a href="#pedidos">Ver todos →</a></div>${ordersTable([...rows].reverse().slice(0, 5))}</div><div class="panel"><div class="panel-head"><h2>Próximas entregas</h2><span>♧</span></div>${
      rows
        .filter(
          (o) => o.delivery && !["Entregue", "Cancelado"].includes(o.status),
        )
        .sort((a, b) => a.delivery.localeCompare(b.delivery))
        .slice(0, 5)
        .map(
          (o) =>
            `<div class="delivery"><div class="date-tile">${o.delivery.slice(8)}<small>${o.delivery.slice(5, 7)}/${o.delivery.slice(0, 4)}</small></div><div><p>${esc(clientName(o.clientId))}</p><small>${esc(o.theme)} · ${o.quantity} peça(s)${o.delivery < today() ? " · Atrasado" : ""}</small></div></div>`,
        )
        .join("") || '<div class="empty">Nenhuma entrega pendente.</div>'
    }</div></div>`;
  bindFilters();
  bindOrderButtons();
}
function bindOrderButtons() {
  document
    .querySelectorAll("[data-order]")
    .forEach((b) => (b.onclick = () => orderDetail(b.dataset.order)));
}
function v1Orders() {
  const rows = active();
  $("#content").innerHTML =
    `<div class="toolbar">${filters()}<button id="new-order">+ Novo pedido</button></div><div class="filters"><input class="search" id="search" placeholder="Pesquisar cliente ou tema" aria-label="Pesquisar pedidos"><select id="status-filter" aria-label="Filtrar status"><option value="">Todos os status</option>${["Aberto", "Em produção", "Pronto", "Entregue", "Cancelado"].map((s) => `<option>${s}</option>`).join("")}</select></div><p class="subtle">Valores e custos ficam registrados no momento da venda. Cancelados não compõem os indicadores.</p><div class="panel" id="order-list"></div>`;
  const renderList = () => {
    const q = $("#search").value.toLocaleLowerCase(),
      s = $("#status-filter").value;
    const source =
      s === "Cancelado"
        ? data.orders.filter(
            (o) =>
              o.status === "Cancelado" &&
              (!range.from || o.date >= range.from) &&
              (!range.to || o.date <= range.to) &&
              (range.demo === "all" ||
                (range.demo === "demo" ? o.demo : !o.demo)),
          )
        : rows;
    $("#order-list").innerHTML = ordersTable(
      source.filter(
        (o) =>
          (!s || o.status === s) &&
          (clientName(o.clientId) + " " + o.theme)
            .toLocaleLowerCase()
            .includes(q),
      ),
    );
    bindOrderButtons();
  };
  renderList();
  $("#search").oninput = renderList;
  $("#status-filter").onchange = renderList;
  $("#new-order").onclick = () => orderForm(false);
  bindFilters();
}
let draftLines = [];
function v1OrderForm(quote = false) {
  draftLines = [];
  const html = `<h2>${quote ? "Simular orçamento" : "Novo pedido"}</h2><p class="subtle">Informe quantidades totais de cada item para o pedido inteiro.</p><form id="order-form"><div class="form-grid">${quote ? "" : `<label class="wide">Cliente<select name="clientId" required><option value="">Selecione</option>${data.clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>`}<label>Data ${quote ? "do orçamento" : "do pedido"}<input name="date" type="date" required value="${today()}"></label>${quote ? "" : `<label>Data de entrega<input name="delivery" type="date" required></label>`}<label>Tema / arte personalizada<input name="theme"></label><label>Coleção<input name="collection"></label><label>Unidade<select name="unit"><option>Peças</option><option>Kits</option></select></label><label>Peças por kit (se usar kits)<input name="piecesPerKit" type="number" min="1" step="1" value="1" required></label><label>Quantidade de kits ou peças<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Valor total da venda (R$)<input name="total" type="number" min="0" step="0.01" required></label><div class="wide"><label>Itens e quantidades totais</label><div id="cost-lines"></div><button type="button" class="secondary" id="add-line">+ Adicionar item</button><p class="form-note">Inclua o modelo, a embalagem e até 8 complementos. Para kits, informe também quantas peças há em cada kit. As quantidades dos itens devem corresponder ao pedido inteiro.</p></div><label>Impressão — custo total (R$)<input name="printing" type="number" min="0" step="0.01" required value="0"></label><label>Outros custos — total (R$)<input name="extra" type="number" min="0" step="0.01" required value="0"></label>${quote ? "" : `<label>Produção<select name="status">${["Aberto", "Em produção", "Pronto", "Entregue", "Cancelado"].map((s) => `<option>${s}</option>`).join("")}</select></label><label>Pagamento<select name="payment"><option>Pendente</option><option>Parcial</option><option>Pago</option></select></label><label class="wide">Observações<textarea name="notes" rows="2"></textarea></label>`}</div><div id="calculation"></div><div class="actions"><button type="button" class="secondary" id="calculate">Calcular custos</button><button>${quote ? "Simular orçamento" : "Salvar pedido"}</button></div></form>`;
  if (quote) $("#content").innerHTML = `<div class="panel">${html}</div>`;
  else modal(html);
  const renderLines = () => {
    $("#cost-lines").innerHTML = draftLines
      .map(
        (l, i) =>
          `<div class="cost-line"><select aria-label="Item ${i + 1}" data-line="${i}"><option value="">Selecione o item</option>${data.catalog.map((c) => `<option value="${c.id}" ${c.id === l.id ? "selected" : ""}>${esc(c.type)} · ${esc(c.name)}</option>`).join("")}</select><input aria-label="Quantidade do item ${i + 1}" type="number" min="1" step="1" value="${l.quantity}" data-qty="${i}"><button type="button" data-remove="${i}" aria-label="Remover item">×</button></div>`,
      )
      .join("");
    document
      .querySelectorAll("[data-line]")
      .forEach(
        (el) =>
          (el.onchange = () =>
            (draftLines[Number(el.dataset.line)].id = el.value)),
      );
    document
      .querySelectorAll("[data-qty]")
      .forEach(
        (el) =>
          (el.oninput = () =>
            (draftLines[Number(el.dataset.qty)].quantity = el.value)),
      );
    document.querySelectorAll("[data-remove]").forEach(
      (el) =>
        (el.onclick = () => {
          draftLines.splice(Number(el.dataset.remove), 1);
          renderLines();
        }),
    );
  };
  $("#add-line").onclick = () => {
    draftLines.push({ id: "", quantity: 1 });
    renderLines();
  };
  $("#add-line").click();
  const input = () => ({
    ...Object.fromEntries(new FormData($("#order-form"))),
    lines: draftLines,
  });
  const showResult = (r) =>
    ($("#calculation").innerHTML =
      `<div class="result"><div>Custo total<strong>${brl(r.cost)}</strong></div><div>Lucro bruto<strong>${brl(r.profit)}</strong></div><div>Margem<strong>${r.margin === null ? "—" : r.margin + "%"}</strong></div></div><p class="form-note">Lucro bruto não desconta despesas fixas ou tributos que não tenham sido incluídos nos custos.</p>`);
  $("#calculate").onclick = async () => {
    try {
      showResult(await api("quote", input()));
    } catch (e) {
      notify(e.message, true);
      const el = document.createElement("p");
      el.className = "error";
      el.textContent = e.message;
      $("#calculation").replaceChildren(el);
    }
  };
  bindForm("#order-form", async () => {
    if (quote) {
      showResult(await api("quote", input()));
      return;
    }
    await api("orders", input());
    $("#modal").close();
    await reload();
    notify("Pedido salvo com seus custos históricos.");
  });
}
function clients() {
  $("#content").innerHTML =
    `<div class="toolbar"><input id="client-search" class="search" placeholder="Pesquisar por nome" aria-label="Pesquisar clientes"><button id="new-client">+ Novo cliente</button></div><div id="client-list" class="panel"></div>`;
  const draw = () => {
    const q = $("#client-search").value.toLocaleLowerCase();
    $("#client-list").innerHTML =
      `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Compras</th><th>Total comprado</th><th>Saldo conhecido / última compra</th><th></th></tr></thead><tbody>${data.clients
        .filter((c) => c.name.toLocaleLowerCase().includes(q))
        .map((c) => {
          const orders = data.orders.filter(
            (o) => o.clientId === c.id && o.status !== "Cancelado",
          );
          return `<tr><td>${esc(c.name)}</td><td>${esc(c.phone || c.email || "Não informado")}</td><td>${orders.length}</td><td>${brl(sum(orders, "total"))}${orders.length > 1 ? "<small>Cliente recorrente</small>" : ""}</td><td>${brl(orders.reduce((s, o) => s + (finance(o).needsReconciliation ? 0 : finance(o).balance), 0))}<small>${orders.some((o) => finance(o).needsReconciliation) ? "Há pagamentos antigos a conferir · " : ""}${day(
            orders
              .map((o) => o.date)
              .sort()
              .at(-1),
          )}</small></td><td><button class="secondary" data-client="${c.id}">Histórico</button></td></tr>`;
        })
        .join("")}</tbody></table></div>`;
    document.querySelectorAll("[data-client]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = data.clients.find((c) => c.id === b.dataset.client);
          modal(
            `<h2>${esc(c.name)}</h2><p>${esc(c.phone)} ${esc(c.email)}</p><p class="subtle">${esc(c.notes)}</p>${ordersTable(data.orders.filter((o) => o.clientId === c.id))}`,
          );
          document.querySelectorAll("#modal [data-order]").forEach(
            (el) =>
              (el.onclick = () => {
                $("#modal").close();
                orderDetail(el.dataset.order);
              }),
          );
        }),
    );
  };
  draw();
  $("#client-search").oninput = draw;
  $("#new-client").onclick = () => {
    modal(
      `<h2>Novo cliente</h2><p class="subtle">Comece pelo nome. Complete o contato quando precisar.</p><form id="client-form"><div class="form-grid"><label class="wide">Nome<input name="name" required maxlength="150"></label><label>Telefone<input name="phone" type="tel"></label><label>E-mail<input name="email" type="email"></label><label class="wide">Observações<textarea name="notes"></textarea></label></div><div class="actions"><button>Salvar cliente</button></div></form>`,
    );
    bindForm("#client-form", async (f) => {
      const body = Object.fromEntries(f);
      const { matches } = await api("v2/clients/check", body);
      if (matches.length) {
        if (
          !window.confirm(
            "Possível duplicidade por telefone ou e-mail: " +
              matches.map((c) => c.name).join(", ") +
              ". Cadastrar separadamente, sem mesclar?",
          )
        )
          return;
        body.duplicateConfirmation = "CADASTRAR SEM MESCLAR";
      }
      await api("clients", body);
      $("#modal").close();
      await reload();
      notify("Cliente cadastrado.");
    });
  };
}
function costs() {
  $("#content").innerHTML =
    `<div class="toolbar"><h2>Catálogo de custos</h2><button id="new-cost">+ Novo item</button></div><p class="subtle">Cada preço tem uma data de vigência. Reajustes não alteram pedidos já registrados.</p><div class="panel"><div class="table-wrap"><table><thead><tr><th>Item</th><th>Categoria</th><th>Custo vigente hoje</th><th>Histórico</th><th></th></tr></thead><tbody>${data.catalog
      .map((c) => {
        const p = [...c.prices]
          .filter((p) => p.date <= today())
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        return `<tr><td>${esc(c.name)}${c.demo ? "<small>Item de demonstração</small>" : ""}</td><td>${esc(c.type)}</td><td>${p ? brl(p.value) : "Sem vigência"}</td><td>${[
          ...c.prices,
        ]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p) => `${day(p.date)}: ${brl(p.value)}`)
          .join(
            "<br>",
          )}</td><td><button class="secondary" data-price="${c.id}">Nova vigência</button></td></tr>`;
      })
      .join("")}</tbody></table></div></div>`;
  $("#new-cost").onclick = () => priceForm();
  document
    .querySelectorAll("[data-price]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          priceForm(data.catalog.find((c) => c.id === b.dataset.price))),
    );
}
function priceForm(item) {
  modal(
    `<h2>${item ? "Nova vigência" : "Novo item de custo"}</h2><p class="subtle">${item ? esc(item.name) : "Cadastre os materiais usados nas suas criações."}</p><form id="price-form"><div class="form-grid">${item ? `<input type="hidden" name="id" value="${item.id}"><input type="hidden" name="name" value="${esc(item.name)}"><input type="hidden" name="type" value="${esc(item.type)}">` : `<label>Nome do item<input name="name" required></label><label>Categoria<select name="type"><option>Modelo</option><option>Embalagem</option><option>Complemento</option></select></label>`}<label>Custo por unidade (R$)<input name="value" type="number" min="0" step="0.01" required></label><label>Válido a partir de<input name="date" type="date" required></label></div><p class="form-note">Não substituímos preços anteriores. Não informe custos ou datas que você não conhece.</p><div class="actions"><button>Salvar custo</button></div></form>`,
  );
  bindForm("#price-form", async (f) => {
    await api("catalog", Object.fromEntries(f));
    $("#modal").close();
    await reload();
    notify("Custo e vigência registrados.");
  });
}
function v1Reports() {
  const rows = active();
  $("#content").innerHTML =
    `<div class="toolbar">${filters()}<a class="button" href="/api/export">↓ Exportar pedidos reais · Excel</a></div>${cards(rows)}<div class="grid2"><div class="panel"><h2>Resultados por mês</h2><p class="subtle">${sum(rows, "quantity")} peças vendidas · ${rows.length} pedidos no período</p><div class="table-wrap"><table><thead><tr><th>Mês</th><th>Vendas</th><th>Custos</th><th>Lucro bruto</th><th>Peças</th></tr></thead><tbody>${months(
      rows,
    )
      .map(
        (m) =>
          `<tr><td>${m.month.split("-").reverse().join("/")}</td><td>${brl(m.total)}</td><td>${brl(m.total - m.profit)}</td><td>${brl(m.profit)}</td><td>${m.quantity}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></div><div class="panel"><h2>Coleções mais vendidas</h2>${rank(rows, "Coleção")}</div></div><div class="grid2"><div class="panel"><h2>Ranking de produtos</h2>${rank(rows, "Modelo")}</div><div class="panel"><h2>Embalagens preferidas</h2>${rank(rows, "Embalagem")}</div></div><p class="form-note">O arquivo Excel exporta a base completa, incluindo dados fictícios identificados. Os indicadores acima respeitam os filtros e excluem cancelados. Receita não equivale a recebimento em caixa.</p>`;
  bindFilters();
}
const importFields = {
  originalId: "ID original do pedido *",
  client: "Cliente *",
  date: "Data do pedido (AAAA-MM-DD) *",
  delivery: "Data de entrega (AAAA-MM-DD) *",
  model: "Modelo *",
  quantity: "Peças *",
  total: "Valor da venda *",
  cost: "Custo histórico total *",
  status: "Produção *",
  payment: "Pagamento *",
  theme: "Tema / arte",
  collection: "Coleção",
  notes: "Observações",
  profit: "Lucro bruto calculado na planilha (opcional, para comparar)",
};
function imports() {
  $("#content").innerHTML =
    `<div class="panel"><h2>Importação com conferência</h2><p>O arquivo original nunca é modificado. Primeiro, leia as abas e escolha as colunas. Nenhum registro é salvo nesta etapa.</p><p class="subtle">Nesta versão importamos pedidos e os nomes dos clientes. A aba Resumo é apenas para conferência. Materiais e suas vigências podem ser conferidos e importados pelo painel abaixo. Fórmulas exigem conferência; custos e datas ausentes bloqueiam a confirmação.</p><label>Arquivo Excel (.xlsx, até 8 MB)<input id="excel-file" type="file" accept=".xlsx"></label><div class="actions"><button id="preview-file">Ler e pré-visualizar</button></div></div><div id="import-preview"></div>`;
  $("#preview-file").onclick = async () => {
    const b = $("#preview-file");
    b.disabled = true;
    try {
      const file = $("#excel-file").files[0];
      if (!file) throw Error("Selecione sua planilha.");
      const f = new FormData();
      f.append("file", file);
      importState = await api("import/preview", f);
      showImport();
    } catch (e) {
      notify(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
}
function v1ShowImport() {
  const s = importState;
  $("#import-preview").innerHTML =
    `<div class="import-step"><h2>1. Inspecione as abas</h2><p class="subtle">Prévia limitada às primeiras 12 linhas. O arquivo todo será validado antes de importar.</p><div class="form-grid"><label>Aba<select id="sheet">${s.sheets.map((x) => `<option>${esc(x.name)}</option>`).join("")}</select></label><label>Linha do cabeçalho<input id="header-row" type="number" min="1" value="1"></label></div><div id="raw-preview" class="table-wrap"></div></div><div class="import-step"><h2>2. Relacione as colunas de pedidos</h2><p class="subtle">Campos com * são obrigatórios. Status aceitos: Aberto, Em produção, Pronto, Entregue ou Cancelado. Pagamento: Pendente, Parcial ou Pago. Datas em AAAA-MM-DD, DD/MM/AAAA ou datas reais do Excel. Agendado será convertido em Aberto, preservando o status original.</p><div id="mapping" class="mapping"></div><div class="actions"><button id="check-import">Conferir todos os registros</button></div></div><div id="checked"></div>`;
  const redraw = () => {
    const sheet = s.sheets.find((x) => x.name === $("#sheet").value),
      head = Number($("#header-row").value) - 1;
    $("#checked").innerHTML = "";
    $("#raw-preview").innerHTML = `<table><tbody>${sheet.rows
      .slice(0, 12)
      .map(
        (r, i) =>
          `<tr><th>${i + 1}</th>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table>`;
    $("#mapping").innerHTML = Object.entries(importFields)
      .map(
        ([key, label]) =>
          `<label>${label}<select data-map="${key}"><option value="">Não selecionada</option>${(sheet.rows[head] || []).map((v, i) => `<option value="${i}">${i + 1}. ${esc(v)}</option>`).join("")}</select></label>`,
      )
      .join("");
    document
      .querySelectorAll("[data-map]")
      .forEach((el) => (el.onchange = () => ($("#checked").innerHTML = "")));
  };
  $("#sheet").onchange = redraw;
  $("#header-row").onchange = redraw;
  redraw();
  $("#check-import").onclick = async () => {
    try {
      const body = {
        token: s.token,
        sheet: $("#sheet").value,
        header: $("#header-row").value,
        mapping: Object.fromEntries(
          [...document.querySelectorAll("[data-map]")].map((el) => [
            el.dataset.map,
            el.value,
          ]),
        ),
      };
      const { rows } = await api("import/check", body);
      const valid = rows.filter((r) => r.valid).length;
      const formulaCount =
        importState.sheets.find((s) => s.name === body.sheet)?.formulaCount ||
        0;
      $("#checked").innerHTML =
        `<div class="import-step"><h2>3. Confira antes de confirmar</h2><p>${valid} válidos · ${rows.length - valid} com pendências · ${rows.length} registros</p><div class="table-wrap"><table><thead><tr><th>Linha</th><th>Cliente</th><th>Pedido / entrega</th><th>Modelo / peças</th><th>Venda</th><th>Custo</th><th>Lucro / margem</th><th>Tema / coleção</th><th>Observações</th><th>Lucro da planilha / divergência</th><th>Resultado</th></tr></thead><tbody>${rows.map((r) => (r.valid ? `<tr><td>${r.line}</td><td>${esc(r.name)}</td><td>${day(r.date)} / ${day(r.delivery)}</td><td>${esc(r.model)} · ${r.quantity}</td><td>${brl(r.total)}</td><td>${brl(r.cost)}</td><td>${brl(r.profit)} / ${r.margin === null ? "—" : r.margin + "%"}</td><td>${esc(r.theme)} / ${esc(r.collection)}</td><td>${esc(r.notes)}</td><td>${r.spreadsheetProfit === null ? "Não informado" : brl(r.spreadsheetProfit) + " / " + brl(r.difference)}</td><td>ID ${esc(r.originalId)} · ${esc(r.status)} · ${esc(r.payment)} ${esc((r.warnings || []).join(" "))}</td></tr>` : `<tr class="check-error"><td>${r.line}</td><td colspan="10">${esc(r.error)}</td></tr>`)).join("")}</tbody></table></div><p class="form-note">Pedidos entram com custo total histórico. A composição e os custos unitários não serão inventados. IDs originais já cadastrados bloqueiam a reimportação. IDs ausentes ou repetidos exigem conferência. Pedidos iguais com IDs diferentes são aceitos.</p><p class="form-note">${formulaCount ? "Esta aba tem " + formulaCount + " fórmula(s). Não as executamos: confira no Excel se os resultados armazenados estão atualizados." : ""} ${rows.some((r) => r.difference) ? "Há divergências entre o lucro da planilha e venda menos custo; confira antes de autorizar." : ""}</p><p><label><input type="checkbox" id="consent"> Conferi os registros, fórmulas e eventuais divergências e autorizo a importação dos dados para este banco local.</label></p><button id="confirm-import" disabled>Confirmar importação local</button></div>`;
      $("#consent").onchange = () =>
        ($("#confirm-import").disabled =
          !$("#consent").checked || valid !== rows.length || !rows.length);
      $("#confirm-import").onclick = async () => {
        const b = $("#confirm-import");
        b.disabled = true;
        try {
          const result = await api("import/confirm", {
            ...body,
            confirmation: "CONFIRMAR IMPORTAÇÃO",
            acceptCachedFormulas: true,
            acceptDifferences: true,
          });
          importState = null;
          await reload();
          notify(
            `${result.count} pedidos importados. Sua planilha original não foi alterada.`,
          );
        } catch (e) {
          notify(e.message, true);
          b.disabled = false;
        }
      };
    } catch (e) {
      notify(e.message, true);
    }
  };
}
function ranking(rows, type) {
  return type === "Coleção"
    ? collectionStats(rows)
        .map((c) => [c.name, c.quantity])
        .sort((a, b) => b[1] - a[1])
    : v1Ranking(rows, type);
}
function finance(o) {
  return (
    data.finance?.find((f) => f.id === o.id) || {
      received: 0,
      balance: o.total,
      payment: "Pendente",
      refundDue: 0,
    }
  );
}
function deliveryState(o) {
  if (o.status === "Cancelado") return "Cancelado";
  if (o.status === "Entregue") return "Concluído";
  if (!o.delivery) return "Sem data";
  const days = Math.round(
    (new Date(o.delivery + "T12:00:00") - new Date(today() + "T12:00:00")) /
      86400000,
  );
  return days < 0 ? "Atrasado" : days <= 3 ? "Entrega próxima" : "No prazo";
}
function collectionStats(rows) {
  const map = new Map();
  for (const o of rows.filter((o) => o.demo !== true)) {
    const lines =
      o.schemaVersion === 2
        ? o.lines
            .filter((l) => l.type === "Modelo")
            .map((l) => ({
              name: l.collection || "Não classificado",
              total: l.revenue,
              cost: l.allocatedCost,
              quantity: l.quantity,
            }))
        : [
            {
              name:
                o.collection ||
                (o.imported
                  ? "Não classificado / conferir"
                  : "Não classificado"),
              total: o.total,
              cost: o.cost,
              quantity: o.quantity,
            },
          ];
    for (const l of lines) {
      const v = map.get(l.name) || {
        name: l.name,
        total: 0,
        cost: 0,
        quantity: 0,
        months: {},
      };
      v.total += l.total;
      v.cost += l.cost;
      v.quantity += l.quantity;
      const m = o.date.slice(0, 7);
      const monthly = v.months[m] || { total: 0, cost: 0, quantity: 0 };
      monthly.total += l.total;
      monthly.cost += l.cost;
      monthly.quantity += l.quantity;
      v.months[m] = monthly;
      map.set(l.name, v);
    }
  }
  return [...map.values()];
}
function collectionsPanel(rows) {
  const stats = collectionStats(rows),
    total = sum(rows, "total");
  return `<div class="panel collection-panel"><div class="panel-head"><h2>Desempenho das coleções</h2><select id="collection-metric" aria-label="Métrica das coleções"><option value="total">Faturamento</option><option value="profit">Lucro bruto</option><option value="quantity">Peças</option></select></div><p class="form-note">Rateio por valor de venda atribuído; custos próprios permanecem no item. Centavos são distribuídos sem duplicar totais.</p><div class="table-wrap"><table><thead><tr><th>Coleção</th><th>Faturamento</th><th>Lucro bruto</th><th>Margem</th><th>Peças</th><th>Participação</th><th>Evolução mensal · faturamento</th></tr></thead><tbody>${stats
    .map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td>${brl(c.total)}</td><td>${brl(c.total - c.cost)}</td><td>${c.total ? (((c.total - c.cost) / c.total) * 100).toFixed(2) + "%" : "—"}</td><td>${c.quantity}</td><td>${total ? ((c.total / total) * 100).toFixed(2) + "%" : "—"}</td><td>${Object.entries(
          c.months,
        )
          .sort()
          .map(
            ([m, n]) => `${m.split("-").reverse().join("/")}: ${brl(n.total)}`,
          )
          .join("<br>")}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div id="collection-bars"></div><h3>Evolução mensal por coleção</h3><div id="collection-evolution"></div></div>`;
}
function bindCollections(rows) {
  const el = $("#collection-metric");
  if (!el) return;
  const draw = () => {
    const metric = el.value,
      stats = collectionStats(rows).map((c) => ({
        ...c,
        profit: c.total - c.cost,
      }));
    const max = Math.max(...stats.map((c) => Math.abs(c[metric])), 1);
    $("#collection-bars").innerHTML =
      stats
        .map(
          (c) =>
            `<div class="rank"><div><span>${esc(c.name)}</span><span>${metric === "quantity" ? c.quantity + " peças" : brl(c[metric])}</span></div><div class="track"><i style="width:${(Math.abs(c[metric]) / max) * 100}%;background:${c[metric] < 0 ? "#bb8582" : "#b8c3a9"}"></i></div></div>`,
        )
        .join("") || '<p class="subtle">Sem dados para este período.</p>';
  };
  const drawAll = () => {
    draw();
    const metric = el.value;
    $("#collection-evolution").innerHTML = collectionStats(rows)
      .map((c) => {
        const values = Object.entries(c.months)
          .sort()
          .map(([month, v]) => ({
            month,
            value: metric === "profit" ? v.total - v.cost : v[metric],
          }));
        const max = Math.max(...values.map((v) => Math.abs(v.value)), 1);
        return `<details class="history" open><summary>${esc(c.name)}</summary>${values.map((v) => `<div class="rank"><div><span>${v.month.split("-").reverse().join("/")}</span><span>${metric === "quantity" ? v.value + " peças" : brl(v.value)}</span></div><div class="track"><i style="width:${(Math.abs(v.value) / max) * 100}%;background:${v.value < 0 ? "#bb8582" : "#b8c3a9"}"></i></div></div>`).join("")}</details>`;
      })
      .join("");
  };
  el.onchange = drawAll;
  drawAll();
}
function cashPanel() {
  const eligible = data.orders.filter((o) => o.demo !== true);
  const ids = new Set(eligible.map((o) => o.id));
  const movements = data.payments.filter(
    (p) =>
      ids.has(p.orderId) &&
      (!range.from || p.date >= range.from) &&
      (!range.to || p.date <= range.to),
  );
  const receipts = sum(
      movements.filter((p) => p.type === "receipt"),
      "value",
    ),
    refunds = sum(
      movements.filter((p) => p.type === "refund"),
      "value",
    );
  const saleRows = active();
  return `<div class="cards cash-cards"><div class="card"><label>Recebimentos por data de entrada</label><strong>${brl(receipts)}</strong><small>Somente movimentos com data e valor</small></div><div class="card rose"><label>Estornos no período</label><strong>${brl(refunds)}</strong><small>Líquido recebido: ${brl(receipts - refunds)}</small></div><div class="card"><label>Saldo conhecido a receber</label><strong>${brl(saleRows.reduce((s, o) => s + (finance(o).needsReconciliation ? 0 : finance(o).balance), 0))}</strong><small>Dos pedidos vendidos no período selecionado</small></div><div class="card rose"><label>Pagamentos antigos a conferir</label><strong>${saleRows.filter((o) => finance(o).needsReconciliation).length}</strong><small>Não presumimos valor nem data do recebimento</small></div></div><p class="form-note">Recebimentos incluem movimentações de pedidos cancelados. A devolver por cancelamentos: ${brl(eligible.reduce((s, o) => s + finance(o).refundDue, 0))}. Lucro bruto não é dinheiro recebido.</p>`;
}
function dashboard() {
  v1Dashboard();
  $("#content").insertAdjacentHTML(
    "beforeend",
    cashPanel() + collectionsPanel(active()),
  );
  bindCollections(active());
}
function reports() {
  v1Reports();
  $("#content").insertAdjacentHTML(
    "beforeend",
    cashPanel() +
      collectionsPanel(active()) +
      `<div class="panel"><h2>Histórico de recebimentos</h2><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Data</th><th>Movimento</th><th>Valor</th><th>Forma / motivo</th></tr></thead><tbody>${data.payments
        .filter(
          (p) =>
            data.orders.some((o) => o.id === p.orderId && o.demo !== true) &&
            (!range.from || p.date >= range.from) &&
            (!range.to || p.date <= range.to),
        )
        .map(
          (p) =>
            `<tr><td>${esc(clientName(data.orders.find((o) => o.id === p.orderId)?.clientId))}</td><td>${day(p.date)}</td><td>${p.type === "receipt" ? "Recebimento" : "Estorno"}</td><td>${brl(p.value)}</td><td>${esc(p.method)} · ${esc(p.reason)}</td></tr>`,
        )
        .join("")}</tbody></table></div></div>`,
  );
  bindCollections(active());
}
function orders() {
  v1Orders();
  $("#status-filter").insertAdjacentHTML(
    "afterend",
    `<select id="delivery-filter" aria-label="Alertas de entrega"><option value="">Todas as entregas</option>${["Entrega próxima", "Atrasado", "Sem data", "Concluído"].map((v) => `<option>${v}</option>`).join("")}</select>`,
  );
  const draw = () => {
    const q = $("#search").value.toLowerCase(),
      status = $("#status-filter").value,
      alert = $("#delivery-filter").value;
    const rows = data.orders.filter(
      (o) =>
        (status ? o.status === status : o.status !== "Cancelado") &&
        (!range.from || o.date >= range.from) &&
        (!range.to || o.date <= range.to) &&
        (range.demo === "all" || (range.demo === "demo" ? o.demo : !o.demo)) &&
        (!alert || deliveryState(o) === alert) &&
        (clientName(o.clientId) + " " + o.theme).toLowerCase().includes(q),
    );
    $("#order-list").innerHTML = ordersTable(rows);
    document.querySelectorAll("#order-list tbody tr").forEach((tr, i) => {
      const td = tr.children[1];
      td.insertAdjacentHTML(
        "beforeend",
        `<small class="delivery-alert ${deliveryState(rows[i]) === "Atrasado" ? "late" : ""}">${deliveryState(rows[i])}</small>`,
      );
    });
    bindOrderButtons();
  };
  $("#search").oninput = draw;
  $("#status-filter").onchange = draw;
  $("#delivery-filter").onchange = draw;
  draw();
}
function costBreakdown(o) {
  return `<div class="table-wrap"><table><thead><tr><th>Componente</th><th>Quantidade</th><th>Custo unitário</th><th>Subtotal</th><th>Coleção / venda atribuída</th></tr></thead><tbody>${o.lines.map((l) => `<tr><td>${esc(l.type)} · ${esc(l.name)}</td><td>${l.quantity}</td><td>${l.unit == null ? "Não informado" : brl(l.unit)}</td><td>${l.total == null ? "Não informado" : brl(l.total)}</td><td>${l.type === "Modelo" ? esc(l.collection || o.collection || "Não classificado") + " · " + (l.sale === undefined ? "Venda individual não informada" : brl(l.sale)) : "Compartilhado"}</td></tr>`).join("")}${[
    ["Impressão", o.printing],
    ["Taxas", o.fees],
    ["Frete", o.shipping],
    ...(o.expenses || []).map((e) => [e.description, e.value]),
    ...(!o.expenses && o.extra
      ? [["Outras despesas históricas", o.extra]]
      : []),
  ]
    .filter(([, n]) => n !== undefined)
    .map(
      ([n, v]) =>
        `<tr><td>${esc(n)}</td><td>—</td><td>—</td><td>${brl(v)}</td><td>Custo comum</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div class="result"><div>Venda<strong>${brl(o.total)}</strong></div><div>Custo total<strong>${brl(o.cost)}</strong></div><div>Lucro bruto<strong>${brl(o.profit)}</strong></div><div>Margem<strong>${o.margin == null ? "—" : o.margin + "%"}</strong></div></div>${
    o.schemaVersion === 2
      ? `<h3>Conferência do rateio</h3><div class="history">${o.lines
          .filter((l) => l.type === "Modelo")
          .map(
            (l) =>
              `${esc(l.name)} / ${esc(l.collection || "Não classificado")}: faturamento ${brl(l.revenue)}, custo próprio ${brl(l.total)}, custo comum rateado ${brl(l.allocatedCommon)}, custo atribuído ${brl(l.allocatedCost)}`,
          )
          .join("<br>")}</div>`
      : '<p class="form-note">Fotografia histórica preservada. A composição não informada não foi inventada.</p>'
  }`;
}
function orderDetail(id) {
  const o = data.orders.find((o) => o.id === id),
    f = finance(o),
    payments = data.payments.filter((p) => p.orderId === id),
    history = data.history.filter((h) => h.orderId === id),
    arts = data.artworks.filter((a) => a.orderId === id);
  modal(
    `<h2>Detalhes do pedido</h2><p>${esc(clientName(o.clientId))} · ${badge(o.status)} · ${deliveryState(o)}</p><p>Pedido: ${day(o.date)} · Entrega: ${day(o.delivery)} · ${o.quantity} peças</p><p>${esc(o.theme)}<br>${esc(o.description)}<br>${esc(o.notes)}</p>${costBreakdown(o)}<div class="result"><div>Recebido líquido<strong>${brl(f.received)}</strong></div><div>Saldo conhecido<strong>${f.needsReconciliation ? "Conferir histórico" : brl(f.balance)}</strong></div><div>Pagamento<strong>${esc(f.payment)}</strong></div></div>${f.needsReconciliation ? `<p class="error">Status antigo: ${esc(f.legacyPayment)}. Não há valor e data de recebimento registrados. Confira os comprovantes antes de lançar.</p>` : ""}${f.refundDue ? `<p class="error">Cancelado com ${brl(f.refundDue)} a devolver. Registre o estorno somente quando o dinheiro for devolvido.</p>` : ""}<div class="actions"><button class="secondary" id="edit-order" ${o.status === "Cancelado" ? "disabled" : ""}>Editar pedido</button><button id="payment-order">Recebimentos / estornos</button><button class="secondary" id="cancel-order" ${o.status === "Cancelado" ? "disabled" : ""}>Cancelar pedido</button></div><h3>Histórico de recebimentos</h3>${payments.map((p) => `<div class="history">${day(p.date)} · ${p.type === "receipt" ? p.label || "Recebimento" : "Estorno"} · ${brl(p.value)} · ${esc(p.method)}<br>${esc(p.reason)}</div>`).join("") || '<p class="subtle">Nenhum recebimento comprovado registrado.</p>'}<h3>Artes da personalização</h3><div class="art-grid">${arts.map((a) => `<article class="history"><img class="art-thumb" src="/api/v2/orders/${o.id}/artworks/${a.id}/file" alt="${esc(a.name)}"><p>${esc(a.name)} · ${esc(a.status)}${a.approvedOn ? " · Aprovada em " + day(a.approvedOn) : ""}</p><button class="secondary" data-art="${a.id}">Versões e aprovação</button></article>`).join("")}</div><form id="art-upload"><label>Adicionar imagem privada (PNG, JPG, WebP, até 8 MB)<input type="file" name="file" accept=".png,.jpg,.jpeg,.webp" required></label><div class="actions"><button ${o.status === "Cancelado" ? "disabled" : ""}>Anexar arte</button></div></form><h3>Histórico de alterações</h3>${history.map((h) => `<details class="history"><summary>${esc(new Date(h.at).toLocaleString("pt-BR"))} · ${esc(h.action)} · ${esc(h.reason)}</summary><p>Venda: ${brl(h.before.total)} → ${brl(h.after.total)} · Custo: ${brl(h.before.cost)} → ${brl(h.after.cost)}</p><pre>${esc(JSON.stringify({ antes: h.before, depois: h.after }, null, 2))}</pre></details>`).join("") || '<p class="subtle">Sem alterações registradas.</p>'}`,
  );
  $("#edit-order").onclick = () => {
    $("#modal").close();
    orderForm(false, o);
  };
  $("#payment-order").onclick = () => {
    $("#modal").close();
    paymentForm(o);
  };
  $("#cancel-order").onclick = () => {
    if (
      !window.confirm(
        "Cancelar este pedido? Recebimentos não serão apagados. Valores recebidos ficarão a devolver até o estorno.",
      )
    )
      return;
    const reason = window.prompt("Motivo do cancelamento:");
    if (!reason) return;
    api("v2/orders/" + id + "/cancel", {
      revision: o.revision || 0,
      reason,
      confirmation: "CONFIRMAR CANCELAMENTO",
    })
      .then(async () => {
        await reload();
        $("#modal").close();
        notify("Cancelamento registrado. Confira os valores a devolver.");
      })
      .catch((e) => notify(e.message, true));
  };
  bindForm("#art-upload", async (form) => {
    await api(`v2/orders/${id}/artworks`, form);
    await reload();
    $("#modal").close();
    orderDetail(id);
  });
  document.querySelectorAll("[data-art]").forEach(
    (b) =>
      (b.onclick = () => {
        $("#modal").close();
        artForm(
          o,
          arts.find((a) => a.id === b.dataset.art),
        );
      }),
  );
}
function paymentForm(o) {
  const receipts = data.payments.filter(
    (p) => p.orderId === o.id && p.type === "receipt",
  );
  modal(
    `<h2>Recebimentos / estornos</h2><p>Venda: ${brl(o.total)} · Recebido: ${brl(finance(o).received)}</p><form id="payment-form"><div class="form-grid"><label>Movimento<select name="type"><option value="receipt">Recebimento</option><option value="refund">Estorno vinculado a recebimento</option></select></label><label>Identificação<select name="label"><option>Sinal</option><option>Complementar</option></select></label><label>Valor (R$)<input name="value" type="number" min="0.01" step="0.01" required></label><label>Data efetiva<input name="date" type="date" required></label><label>Forma de pagamento<select name="method"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select></label><label>Recebimento original (para estorno)<select name="receiptId"><option value="">Selecione</option>${receipts.map((p) => `<option value="${p.id}">${day(p.date)} · ${brl(p.value)} · ${esc(p.method)}</option>`).join("")}</select></label><label class="wide">Motivo / identificação<input name="reason" required></label></div><p class="form-note">Correções são feitas por estorno e novo lançamento, sem apagar o original. Não aceitamos recebimentos acima do saldo.</p><div class="actions"><button>Conferir e registrar movimento</button></div></form>`,
  );
  bindForm("#payment-form", async (f) => {
    const body = Object.fromEntries(f);
    if (
      !window.confirm(
        `Registrar ${body.type === "refund" ? "estorno" : "recebimento"} de ${brl(body.value)} na data ${day(body.date)}?`,
      )
    )
      return;
    await api(`v2/orders/${o.id}/payments`, {
      ...body,
      revision: o.revision || 0,
      confirmLegacy: finance(o).needsReconciliation
        ? "CONFIRMAR RECEBIMENTO HISTÓRICO"
        : undefined,
      confirmation: body.type === "refund" ? "CONFIRMAR ESTORNO" : undefined,
    });
    $("#modal").close();
    await reload();
    orderDetail(o.id);
  });
}
function artForm(o, a) {
  modal(
    `<h2>Arte e histórico de versões</h2><img class="art-preview" src="/api/v2/orders/${o.id}/artworks/${a.id}/file" alt="${esc(a.name)}"><form id="art-form"><div class="form-grid"><label>Situação<select name="status">${["Em elaboração", "Enviada", "Aprovada", "Substituída", "Removida"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Data de aprovação (obrigatória ao aprovar)<input name="approvedOn" type="date" value="${a.approvedOn || ""}"></label><label class="wide">Motivo<input name="reason" required></label></div><p class="form-note">Remoção é lógica: preservamos o arquivo e o histórico. Para outra versão, anexe um novo arquivo e marque a anterior como substituída.</p><div class="actions"><button>Salvar situação da arte</button></div></form>${a.history.map((h) => `<p class="history">${esc(new Date(h.at).toLocaleString("pt-BR"))} · ${esc(h.before.status)} → ${esc(h.after.status)} · ${esc(h.reason)}</p>`).join("")}`,
  );
  bindForm("#art-form", async (f) => {
    const b = Object.fromEntries(f);
    if (
      b.status === "Removida" &&
      !window.confirm(
        "Confirmar remoção lógica? A versão será preservada no histórico.",
      )
    )
      return;
    await api(
      `v2/orders/${o.id}/artworks/${a.id}`,
      { ...b, version: a.history.length, confirmation: "CONFIRMAR REMOÇÃO" },
      "PATCH",
    );
    $("#modal").close();
    await reload();
    orderDetail(o.id);
  });
}
function orderForm(quote = false, old = null) {
  if (quote) {
    v1OrderForm(true);
    $("#content").insertAdjacentHTML(
      "beforeend",
      `<div class="panel"><h2>Preço por margem desejada</h2><form id="margin-form"><div class="form-grid"><label>Custo unitário dos materiais (R$)<input name="unitCost" type="number" min="0" step="0.01" required></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Custos adicionais totais (R$)<input name="additional" type="number" min="0" step="0.01" value="0" required></label><label>Margem bruta desejada (%)<input name="margin" type="number" min="0" max="99.99" step="0.01" required></label></div><p class="form-note">Preço = custo ÷ (1 − margem/100). Margem é calculada sobre a venda; custo zero não permite margem percentual definida.</p><div class="actions"><button>Sugerir preço</button></div><div id="margin-result"></div></form></div>`,
    );
    bindForm("#margin-form", async (f) => {
      const r = await api("v2/suggest", Object.fromEntries(f));
      $("#margin-result").innerHTML =
        `<div class="result"><div>Preço sugerido<strong>${brl(r.total)}</strong></div><div>Lucro bruto<strong>${brl(r.profit)}</strong></div><div>Margem resultante<strong>${r.margin === null ? "Indefinida" : r.margin + "%"}</strong></div></div>`;
    });
    return;
  }
  const state = {
    lines: old
      ? old.lines.map((l, i) => ({
          ...l,
          key: l.key ?? String(i),
          collection:
            l.collection ?? (old.imported ? "" : old.collection || ""),
          sale:
            l.sale ??
            (old.lines.filter((x) => x.type === "Modelo").length === 1
              ? old.total
              : ""),
          reviseCost: false,
        }))
      : [
          {
            key: crypto.randomUUID(),
            id: "",
            quantity: 1,
            collection: "",
            sale: "",
            reviseCost: false,
          },
        ],
    expenses: old
      ? (
          old.expenses ||
          (old.extra
            ? [{ description: "Outras despesas históricas", value: old.extra }]
            : [])
        ).map((e) => ({ ...e }))
      : [],
  };
  const inputField = (label, name, value = "", type = "text", extra = "") =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  modal(
    `<h2>${old ? "Editar pedido" : "Novo pedido"}</h2><p class="subtle">Quantidades de materiais referem-se ao pedido inteiro. A revisão financeira exige conferência e confirmação.</p><form id="v2-order-form"><div class="form-grid"><label class="wide">Cliente<select name="clientId" required><option value="">Selecione</option>${data.clients.map((c) => `<option value="${c.id}" ${c.id === old?.clientId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>${inputField("Data do pedido", "date", old?.date || today(), "date", "required")}${inputField("Data de entrega (opcional)", "delivery", old?.delivery || "", "date")}${inputField("Tema / arte personalizada", "theme", old?.theme || "")}<label>Produção<select name="status">${["Aberto", "Em produção", "Pronto", "Entregue"].map((s) => `<option ${s === old?.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label class="wide">Descrição da personalização<textarea name="description">${esc(old?.description || "")}</textarea></label><label class="wide">Observações<textarea name="notes">${esc(old?.notes || "")}</textarea></label></div>${old ? '<p><label><input type="checkbox" id="financial-edit"> Revisar composição, valores ou coleções (alteração financeira)</label></p>' : ""}<fieldset id="financial-fields" ${old ? "disabled" : ""}><legend>Fotografia financeira e itens</legend><div class="form-grid"><label>Unidade<select name="unit"><option ${old?.unit !== "Kits" ? "selected" : ""}>Peças</option><option ${old?.unit === "Kits" ? "selected" : ""}>Kits</option></select></label>${inputField("Quantidade de kits ou peças", "amount", old?.amount || old?.quantity || 1, "number", 'min="1" step="1" required')}${inputField("Peças por kit", "piecesPerKit", old?.piecesPerKit || 1, "number", 'min="1" step="1" required')}${inputField("Valor total da venda (R$)", "total", old?.total ?? "", "number", 'min="0" step="0.01" required')}${inputField("Desconto geral (R$)", "discount", old?.discount || 0, "number", 'min="0" step="0.01" required')}</div><h3>Modelos, embalagens e até oito complementos</h3><div id="v2-lines"></div><button type="button" class="secondary" id="v2-add-line">+ Adicionar item</button><p class="form-note">Para cada modelo, informe coleção e valor de venda atribuído ao conjunto de unidades dessa linha, antes do desconto geral. É permitido repetir um modelo em coleções diferentes. Materiais comuns são rateados proporcionalmente às vendas; se todas forem zero, pelo número de peças.</p><div class="form-grid">${inputField("Impressão — custo total (R$)", "printing", old?.printing || 0, "number", 'min="0" step="0.01" required')}${inputField("Taxas — total (R$)", "fees", old?.fees || 0, "number", 'min="0" step="0.01" required')}${inputField("Frete — custo total (R$)", "shipping", old?.shipping || 0, "number", 'min="0" step="0.01" required')}</div><h3>Outras despesas identificadas</h3><div id="v2-expenses"></div><button type="button" class="secondary" id="v2-add-expense">+ Adicionar despesa</button><p><label><input type="checkbox" name="confirmCosts" id="confirm-costs"> Conferi e autorizo os custos unitários que marquei para revisão explícita.</label></p></fieldset>${old ? inputField("Motivo da alteração", "reason", "", "text", "required") : '<p><label><input type="checkbox" name="demo" checked> Pedido fictício de teste</label></p>'}<div id="calculation"></div><div class="actions"><button type="button" class="secondary" id="v2-calculate">Conferir custos e rateio</button><button>${old ? "Conferir e salvar revisão" : "Salvar pedido"}</button></div></form>`,
  );
  const renderLines = () => {
    $("#v2-lines").innerHTML = state.lines
      .map((l, i) => {
        const type = data.catalog.find((c) => c.id === l.id)?.type || l.type;
        return `<div class="line-editor"><div class="cost-line"><select aria-label="Item ${i + 1}" data-index="${i}" data-property="id"><option value="">Selecione o item</option>${!data.catalog.some((c) => c.id === l.id) && l.id ? `<option value="${esc(l.id)}" selected>${esc(l.name)} (histórico)</option>` : ""}${data.catalog.map((c) => `<option value="${c.id}" ${l.id === c.id ? "selected" : ""}>${esc(c.type)} · ${esc(c.name)}</option>`).join("")}</select><input aria-label="Quantidade do item ${i + 1}" type="number" min="1" step="1" value="${l.quantity}" data-index="${i}" data-property="quantity"><button type="button" data-delete-line="${i}" aria-label="Remover item ${i + 1}">×</button></div>${type === "Modelo" ? `<div class="form-grid"><label>Coleção do item ${i + 1}<input value="${esc(l.collection)}" data-index="${i}" data-property="collection"></label><label>Venda atribuída ao item ${i + 1} (R$)<input type="number" min="0" step="0.01" value="${l.sale}" data-index="${i}" data-property="sale"></label></div>` : ""}<p class="form-note">${l.unit === null ? "Custo histórico unitário desconhecido." : l.unit !== undefined ? "Custo unitário histórico: " + brl(l.unit) : "Novo item: custo da vigência na data do pedido."}</p><label><input type="checkbox" data-revise="${i}" ${l.reviseCost ? "checked" : ""}> Revisar explicitamente custo unitário</label>${l.reviseCost ? `<label>Novo custo unitário (R$)<input type="number" min="0" step="0.01" value="${l.unit ?? ""}" data-index="${i}" data-property="unit"></label>` : ""}</div>`;
      })
      .join("");
    document.querySelectorAll("[data-property]").forEach(
      (el) =>
        (el.oninput = () => {
          state.lines[el.dataset.index][el.dataset.property] = el.value;
          if (el.dataset.property === "id") renderLines();
        }),
    );
    document.querySelectorAll("[data-revise]").forEach(
      (el) =>
        (el.onchange = () => {
          state.lines[el.dataset.revise].reviseCost = el.checked;
          renderLines();
        }),
    );
    document.querySelectorAll("[data-delete-line]").forEach(
      (el) =>
        (el.onclick = () => {
          state.lines.splice(Number(el.dataset.deleteLine), 1);
          renderLines();
        }),
    );
  };
  const renderExpenses = () => {
    $("#v2-expenses").innerHTML = state.expenses
      .map(
        (e, i) =>
          `<div class="cost-line"><input aria-label="Descrição da despesa ${i + 1}" value="${esc(e.description)}" data-exp="${i}" data-key="description"><input aria-label="Valor da despesa ${i + 1}" type="number" min="0" step="0.01" value="${e.value}" data-exp="${i}" data-key="value"><button type="button" data-delete-exp="${i}">×</button></div>`,
      )
      .join("");
    document
      .querySelectorAll("[data-exp]")
      .forEach(
        (el) =>
          (el.oninput = () =>
            (state.expenses[el.dataset.exp][el.dataset.key] = el.value)),
      );
    document.querySelectorAll("[data-delete-exp]").forEach(
      (el) =>
        (el.onclick = () => {
          state.expenses.splice(Number(el.dataset.deleteExp), 1);
          renderExpenses();
        }),
    );
  };
  renderLines();
  renderExpenses();
  $("#v2-add-line").onclick = () => {
    state.lines.push({
      key: crypto.randomUUID(),
      id: "",
      quantity: 1,
      collection: "",
      sale: "",
      reviseCost: false,
    });
    renderLines();
  };
  $("#v2-add-expense").onclick = () => {
    state.expenses.push({ description: "", value: 0 });
    renderExpenses();
  };
  if (old)
    $("#financial-edit").onchange = () => {
      $("#financial-fields").disabled = !$("#financial-edit").checked;
      $("#calculation").innerHTML = "";
    };
  const draft = () => ({
    ...Object.fromEntries(new FormData($("#v2-order-form"))),
    lines: state.lines,
    expenses: state.expenses,
    confirmCosts: $("#confirm-costs").checked,
    status: $("#v2-order-form [name=status]").value,
  });
  $("#v2-calculate").onclick = async () => {
    try {
      if (old && !$("#financial-edit").checked) {
        $("#calculation").innerHTML = costBreakdown(old);
        return;
      }
      const r = await api("v2/quote", { ...draft(), orderId: old?.id });
      $("#calculation").innerHTML = costBreakdown(r);
    } catch (e) {
      $("#calculation").innerHTML = `<p class="error">${esc(e.message)}</p>`;
    }
  };
  bindForm("#v2-order-form", async () => {
    const d = draft();
    if (old) {
      const financial = $("#financial-edit").checked;
      if (financial) {
        const result = await api("v2/quote", { ...d, orderId: old.id });
        $("#calculation").innerHTML = costBreakdown(result);
        if (
          !window.confirm(
            `Confirmar revisão financeira? Venda: ${brl(old.total)} → ${brl(result.total)}. Custo: ${brl(old.cost)} → ${brl(result.cost)}. O histórico anterior será preservado.`,
          )
        )
          return;
      }
      await api(
        "v2/orders/" + old.id,
        {
          draft: d,
          revision: old.revision || 0,
          reason: d.reason,
          financial,
          confirmation: financial ? "CONFIRMAR REVISÃO FINANCEIRA" : undefined,
        },
        "PUT",
      );
    } else {
      const result = await api("v2/quote", d);
      $("#calculation").innerHTML = costBreakdown(result);
      if (
        !window.confirm(
          "Conferiu os itens e o rateio? Salvar venda de " +
            brl(result.total) +
            " e custo de " +
            brl(result.cost) +
            "?",
        )
      )
        return;
      await api("v2/orders", { ...d, demo: d.demo === "on" });
    }
    $("#modal").close();
    await reload();
    notify(
      "Pedido salvo. A fotografia financeira e o histórico foram preservados.",
    );
  });
}
function showImport() {
  v1ShowImport();
  $("#import-preview").insertAdjacentHTML(
    "beforeend",
    `<div class="import-step"><h2>Materiais e histórico de custos</h2><p>Selecione uma aba e associe nome, categoria (Modelo, Embalagem ou Complemento), custo e vigência. Não inferimos datas nem categorias.</p><div class="mapping">${[
      ["name", "Nome"],
      ["type", "Categoria"],
      ["value", "Custo"],
      ["date", "Vigência"],
    ]
      .map(
        ([k, label]) =>
          `<label>${label}<select data-material="${k}"><option value="">Selecione</option></select></label>`,
      )
      .join(
        "",
      )}</div><div class="actions"><button id="check-materials">Conferir materiais</button></div><div id="material-result"></div></div>`,
  );
  const refreshMaterials = () => {
    const sheet = importState.sheets.find((s) => s.name === $("#sheet").value),
      header = Number($("#header-row").value) - 1;
    document
      .querySelectorAll("[data-material]")
      .forEach(
        (el) =>
          (el.innerHTML =
            '<option value="">Selecione</option>' +
            (sheet.rows[header] || [])
              .map((v, i) => `<option value="${i}">${esc(v)}</option>`)
              .join("")),
      );
    $("#material-result").innerHTML = "";
  };
  $("#sheet").addEventListener("change", refreshMaterials);
  $("#header-row").addEventListener("change", refreshMaterials);
  refreshMaterials();
  document
    .querySelectorAll("[data-material]")
    .forEach(
      (el) => (el.onchange = () => ($("#material-result").innerHTML = "")),
    );
  $("#check-materials").onclick = async () => {
    try {
      const body = {
        token: importState.token,
        sheet: $("#sheet").value,
        header: $("#header-row").value,
        mapping: Object.fromEntries(
          [...document.querySelectorAll("[data-material]")].map((el) => [
            el.dataset.material,
            el.value,
          ]),
        ),
      };
      const result = await api("import/materials/check", body);
      $("#material-result").innerHTML =
        `<div class="table-wrap"><table><thead><tr><th>Linha</th><th>Material</th><th>Categoria</th><th>Custo</th><th>Vigência / pendência</th></tr></thead><tbody>${result.rows.map((r) => (r.valid ? `<tr><td>${r.line}</td><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td>${brl(r.value)}</td><td>${day(r.date)}</td></tr>` : `<tr><td>${r.line}</td><td colspan="4">${esc(r.error)}</td></tr>`)).join("")}</tbody></table></div><p><label><input id="materials-consent" type="checkbox"> Conferi e autorizo importar os materiais apresentados.</label></p><button id="confirm-materials" disabled>Confirmar importação de materiais</button>`;
      $("#materials-consent").onchange = () =>
        ($("#confirm-materials").disabled =
          !$("#materials-consent").checked ||
          !result.rows.length ||
          result.rows.some((r) => !r.valid));
      $("#confirm-materials").onclick = async () => {
        try {
          await api("import/materials/confirm", {
            ...body,
            confirmation: "CONFIRMAR IMPORTAÇÃO DE MATERIAIS",
          });
          await reload();
          notify("Materiais importados com histórico preservado.");
        } catch (e) {
          notify(e.message, true);
        }
      };
    } catch (e) {
      notify(e.message, true);
    }
  };
}
function backups() {
  $("#content").innerHTML =
    `<div class="panel"><h2>Cópia privada dos seus dados</h2><p>O backup reúne uma fotografia consistente do SQLite e as artes, com verificação de integridade. Guarde-o em local privado. Não envie ao GitHub.</p><button id="backup-download">Criar e baixar backup</button><div id="backup-result"></div></div><div class="panel"><h2>Testar restauração sem substituir seus dados</h2><p>Escolha um backup. Primeiro verificamos seus arquivos; após a confirmação, restauramos em uma pasta nova. O banco ativo permanece intacto.</p><input id="restore-file" type="file" accept=".zip" aria-label="Backup para restauração"><div class="actions"><button id="restore-preview">Conferir backup</button></div><div id="restore-result"></div></div>`;
  $("#backup-download").onclick = async () => {
    const b = $("#backup-download");
    b.disabled = true;
    try {
      const r = await api("v2/backups", {});
      $("#backup-result").innerHTML =
        `<p class="success">Backup criado e verificado. <a href="/api/v2/backups/${r.id}">Clique aqui para baixar o arquivo privado.</a></p>`;
    } catch (e) {
      notify(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
  $("#restore-preview").onclick = async () => {
    try {
      const file = $("#restore-file").files[0];
      if (!file) throw Error("Selecione um backup.");
      const f = new FormData();
      f.append("file", file);
      const r = await api("v2/restore/preview", f);
      $("#restore-result").innerHTML =
        `<p>Backup de ${esc(new Date(r.manifest.createdAt).toLocaleString("pt-BR"))}. ${Object.keys(r.manifest.files).length} arquivos com integridade verificada.</p><button id="restore-confirm">Restaurar cópia em pasta nova</button>`;
      $("#restore-confirm").onclick = async () => {
        try {
          if (
            !window.confirm(
              "Restaurar em pasta nova, sem substituir o banco atual?",
            )
          )
            return;
          const result = await api("v2/restore/confirm", {
            token: r.token,
            confirmation: "RESTAURAR EM NOVA PASTA",
          });
          $("#restore-result").textContent =
            result.message + " Pasta: " + result.directory;
        } catch (e) {
          notify(e.message, true);
        }
      };
    } catch (e) {
      notify(e.message, true);
    }
  };
}
pages.backups = [
  "⇩",
  "Backup e restauração",
  "Seu trabalho bem guardado",
  "Cópias privadas, verificadas e sem sobrescrever o original.",
];

function render() {
  route = location.hash.slice(1);
  if (!pages[route]) route = "painel";
  const p = pages[route];
  $("#title").textContent = p[2];
  $("#subtitle").textContent = p[3];
  $("#breadcrumb").textContent = p[1].toUpperCase();
  $("#nav").innerHTML = Object.entries(pages)
    .map(
      ([key, v]) =>
        `<a href="#${key}" class="${key === route ? "active" : ""}"><span>${v[0]}</span>${v[1]}</a>`,
    )
    .join("");
  ({
    painel: dashboard,
    pedidos: orders,
    clientes: clients,
    custos: costs,
    orcamento: () => orderForm(true),
    relatorios: reports,
    importar: imports,
    backups,
  })[route]();
}
async function reload() {
  const [base, extra] = await Promise.all([api("data"), api("v2/data")]);
  data = {
    ...base,
    ...{
      payments: extra.payments,
      history: extra.history,
      artworks: extra.artworks,
      finance: extra.orders,
    },
  };
  render();
}
window.addEventListener("hashchange", () => {
  $("#notice").className = "";
  $("#notice").textContent = "";
  $("#modal").close();
  render();
});
api("session")
  .then(() => reload())
  .catch((e) =>
    notify("Não foi possível carregar o sistema: " + e.message, true),
  );
