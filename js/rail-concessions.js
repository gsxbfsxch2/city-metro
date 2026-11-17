'use strict';
// 铁路经营权（v2.8）：城市周边的既有干线铁路与新干线。线路走向做了简化；签约前后同一条线路都参与客流分配，
// 未签约时乘客照常可以坐（只是不算本公司的收入），签约后公司接管运营、按班次支付月度费用并分享票款。
(function (CM) {
  const R = CM.RailConcessions = {};
  const jin = { id: 'jin', name: '金山铁路', from: 2012, month: 9, color: '#8e6c40', start: 2, startExpress: 1, max: 4, fee: 75, entry: 1800, share: 0.08, speed: 160, stations: [
    ['上海南站', 31.1553, 121.4266], ['莘庄', 31.111, 121.385, 2025],
    ['春申', 31.091, 121.355], ['新桥', 31.061, 121.307], ['车墩', 31.007, 121.313],
    ['叶榭', 30.942, 121.318], ['亭林', 30.890, 121.344], ['金山园区', 30.826, 121.351], ['金山卫', 30.727, 121.345],
  ] };
  // 东海道新干线：现实 1964-10-01 开通。东京地图南界到川崎临海部（新横浜在图外约 3 格），
  // 参照九广铁路「罗湖」的做法，把图外的终点站沿投影方向夹到地图边缘，站名保留。
  const tokaido = { id: 'tokaido', name: '东海道新干线', from: 1964, month: 10, color: '#1b5fa8', start: 2, startExpress: 1, max: 6, fee: 140, entry: 3200, share: 0.08, speed: 210, stations: [
    ['東京', 35.6812, 139.7671], ['品川', 35.6285, 139.7387], ['新横浜', 35.5068, 139.6176, null, null, 'edge'],
  ] };
  R.definition = function (g) { return ({ sh: jin, tk: tokaido })[g.mapId]; };
  R.phaseDates = { jin: [2025], tokaido: [] };
  R.available = function (g, d) { return g.clock.y > d.from || (g.clock.y === d.from && g.clock.m >= (d.month || 1)); };
  R.terms = function (g, d, state) {
    state = state === undefined ? g.railConcession : state;
    const local = state && state.local != null ? state.local : d.start;
    const express = state && state.express != null ? state.express : (d.startExpress || 0);
    const scale = CM.Metro.costIndex(g.clock.y);
    return { local: local, express: express, entry: d.entry * scale, monthly: d.fee * scale * (local + express) };
  };
  const stationPos = function (g, d, name, lat, lon, flag) {
    const map = CM.curMap(), geo = map.geo, p = geo.proj;
    const W = geo.w != null ? geo.w : map.cfg.W, H = geo.h != null ? geo.h : map.cfg.H;
    const place = (geo.places || []).find(function (row) { return row[0] === name && row[3] === 1; });
    let x, y;
    if (place && d.id === 'jin' && name !== '上海南站') { x = place[1]; y = place[2]; }
    else if (place && d.id !== 'jin') { x = place[1]; y = place[2]; }
    else { x = (lon - p.lon0) * p.kx; y = (p.lat0 - lat) * p.ky; }
    if (g.city.cellAt(x, y) >= 0) return [x, y];
    // 图外终点站向地图中心逐步移动，直到落在可建设的地块上（参照九广铁路罗湖的做法）
    if (flag === 'edge') {
      const cx = W / 2, cy = H / 2, dx = cx - x, dy = cy - y, len = Math.hypot(dx, dy) || 1;
      for (let t = 0; t <= 16; t += 0.5) {
        const nx = Math.min(W - 0.6, Math.max(0.6, x + dx / len * t));
        const ny = Math.min(H - 0.6, Math.max(0.6, y + dy / len * t));
        if (g.city.cellAt(nx, ny) >= 0) return [nx, ny];
      }
    }
    return null;
  };
  // 当前日期下铁路的车站表（含图外终点站向图内收拢）
  const stopList = function (g, d) {
    const out = [];
    for (let i = 0; i < d.stations.length; i++) {
      const row = d.stations[i], name = row[0], lat = row[1], lon = row[2], from = row[3], to = row[4], flag = row[5];
      if ((from && g.clock.y < from) || (to && g.clock.y >= to)) continue;
      const pos = stationPos(g, d, name, lat, lon, flag);
      if (!pos) continue;
      out.push({ id: 's' + (900000 + i), name: name, x: pos[0], y: pos[1], type: d.id === 'tokaido' ? 'elevated' : 'surface' });
    }
    return out;
  };
  R.stops = function (g, d) { return stopList(g, d || R.definition(g)); };
  // 铁路车站并入可编辑线网（v2.8.1）：车站属铁路公司，不能改建/拆除，但可以在地图上查看、接入本线并与本线同站换乘。
  // 铁路线路与区间仍只存在于编译后的线网（overlay），不进入玩家的线路列表、车队与拆除操作。
  R.syncNet = function (g, net) {
    const d = R.definition(g);
    net = net || g.net;
    if (!d || !g.city || !net || !net.stations || !R.available(g, d)) return 0;
    let n = 0;
    for (const st of stopList(g, d)) {
      const cur = net.stations[st.id], built = [d.from, d.month || 1];
      if (!cur) { net.stations[st.id] = { id: st.id, name: st.name, x: st.x, y: st.y, type: st.type, size: 'L', rail: d.id, inherited: true, built: built }; n++; continue; }
      const moved = cur.x !== st.x || cur.y !== st.y || cur.type !== st.type || cur.size !== 'L' || !cur.rail;
      cur.name = st.name; cur.x = st.x; cur.y = st.y; cur.type = st.type; cur.size = 'L'; cur.rail = d.id; cur.inherited = true; cur.built = cur.built || built;
      if (moved) n++;
    }
    return n;
  };
  R.overlay = function (net, g, state) {
    const d = R.definition(g);
    if (!d || !R.available(g, d)) return net;
    state = state === undefined ? g.railConcession : state;
    const q = R.terms(g, d, state), local = q.local, express = q.express;
    const n = { ...net, stations: { ...net.stations }, segments: { ...net.segments }, lines: { ...net.lines } };
    const line = { id: 'l900000', name: d.name, color: d.color, speed: d.speed, rail: d.id, railOwned: !!state, rootSet: true, railFreq: local, railShare: d.share || 0 };
    n.lines[line.id] = line;
    const stops = [];
    for (const st of stopList(g, d)) {
      // 合并而非覆盖：保留玩家在本站设置的站台层（天地换乘）、站台方向等字段
      const base = n.stations[st.id] || {};
      n.stations[st.id] = Object.assign({}, base, { id: st.id, name: st.name, x: st.x, y: st.y, type: st.type, size: 'L', rail: d.id, inherited: true });
      const id = st.id, prev = stops.length ? stops[stops.length - 1] : null;
      if (prev) n.segments['g' + id.slice(1)] = { id: 'g' + id.slice(1), a: prev, b: id, line: line.id, pts: [], type: st.type, inherited: true };
      stops.push(id);
    }
    line.root = stops[0];
    if (express && stops.length > 2) line.svcs = [{ id: 'rail-express', name: '直达', skip: stops.slice(1, -1), railFreq: express }];
    return n;
  };
  R.compile = function (net, g, state) { return CM.Metro.compile(R.overlay(net, g, state), g.city); };
  R.due = function (g, d, plan) {
    const q = R.terms(g, d, plan), first = !g.railConcession;
    const days = CM.U.daysInMonth(g.clock.y, g.clock.m);
    const remaining = (days - g.clock.d + 1) / days;
    const current = first ? 0 : R.terms(g, d).monthly;
    return (first ? q.entry : 0) + Math.max(0, q.monthly - current) * remaining;
  };
  R.change = function (g, local, express) {
    const d = R.definition(g);
    if (!d || !R.available(g, d) || g.pending || g.jumping || (g.draft && g.draft.liveSnap) || (g.model && g.model.predJob)) return '当前不能调整铁路合同';
    if (!Number.isInteger(local) || !Number.isInteger(express) || local < 1 || express < 0 || local + express > d.max) return '班次超出合同允许范围';
    const first = !g.railConcession, due = R.due(g, d, { local: local, express: express });
    if (!g.econ.canAfford(due)) return '可用资金不足';
    g.econ.spend('pppOut', due);
    g.railConcession = { local: local, express: express };
    g.logEvent({ tag: '运营', title: (first ? '签约接管：' : '调整铁路班次：') + d.name,
      desc: '每方向每小时站站停 ' + local + ' 班' + (express ? '，直达 ' + express + ' 班' : '') + '。' });
    g.refreshOperations();
    return null;
  };
  R.monthly = function (g) {
    const d = R.definition(g);
    if (!d) return;
    if (!R.available(g, d)) return;
    if (!g.railConcession) {
      // 现实开通的那个月发一次游戏内公告（v2.8）
      if (g.railNotice !== d.id) {
        g.railNotice = d.id;
        g.logEvent({ tag: '铁路', title: d.name + '开通', desc: '现实于 ' + d.from + ' 年 ' + (d.month || 1) + ' 月开通，最高时速 ' + d.speed + ' km/h。可在「任务 → 铁路经营权」中查看并签约接管。' });
        g.touch();
      }
      return;
    }
    g.econ.spend('pppOut', R.terms(g, d).monthly);
  };
})(window.CM);
