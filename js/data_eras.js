'use strict';
// 地图数据修订（社区版：只保留东京与上海）：东京湾填海地形按当前网格裁剪，其余城市已删除。
(function (CM) {
  const tk = CM.MAPS.tk;
  tk.data.terrainRevision = 2;
  for (const r of tk.data.reclaim || []) r.poly = CM.U.clipMapPolygon(r.poly, tk.cfg.W, tk.cfg.H);
  tk.data.reclaim = (tk.data.reclaim || []).filter(r => r.poly.length >= 3);
  Object.assign(CM.DATA, CM.MAPS[CM.mapId || 'tk'].data);
})(window.CM);
