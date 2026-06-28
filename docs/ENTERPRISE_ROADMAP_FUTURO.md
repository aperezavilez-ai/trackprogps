# TrackProGPS — Roadmap futuro (24 meses)

**Visión:** Plataforma inteligente de telemática empresarial global  
**Metodología:** Fases incrementales sin romper producción

---

## Timeline

```
2026 Q2-Q3          2026 Q4           2027 Q1-Q2         2027 Q3-Q4
─────────────────────────────────────────────────────────────────────
TrackPro AI v1      Analytics dash    Playbooks v1       API v1 public
Anomalías v1        Route opt v1      IoT events         White label
KPI snapshots       AI reports auto   100k scale prep    500k arch POC
Mobile polish       Video prep        SSO/2FA            ML predict v2
```

---

## Fase por trimestre

### Q2 2026 (actual → +3 meses) ✅ base

- [x] Auditoría arquitectura
- [x] Mobile tracking v1
- [x] Combustible km/L
- [x] Documentación enterprise
- [ ] TrackPro AI — expandir tools (historial, velocidad, idle)
- [ ] Dashboard KPIs v1
- [ ] `ai_conversations` + audit

### Q3 2026

- [ ] Detección anomalías v1 (desvío, paradas, horario)
- [ ] Reportes IA programados (diario/semanal)
- [ ] Analytics `/analytics` con gráficas
- [ ] Playbooks schema + UI básica
- [ ] Type-check CI obligatorio

### Q4 2026

- [ ] Optimización rutas v1 (Google Directions)
- [ ] `telemetry_events` + mapeo Teltonika IO
- [ ] API pública v1 + Swagger `/developers`
- [ ] Webhooks salientes
- [ ] 2FA admin

### Q1 2027

- [ ] Playbooks producción (templates industria)
- [ ] White label dominio + branding
- [ ] Batch insert historial + read replica eval
- [ ] Video events schema + partner POC
- [ ] Mobile: fotos evidencia + upload storage

### Q2 2027

- [ ] SSO enterprise (SAML)
- [ ] ML predictivo mantenimiento v1
- [ ] Stream ingest POC (100k devices)
- [ ] Multi-región GPS eval (LATAM)
- [ ] SOC2 prep documental

### Q3–Q4 2027

- [ ] Escala 500k architecture decision
- [ ] Videotelemática integración live
- [ ] Marketplace integraciones
- [ ] i18n EN
- [ ] App stores enterprise branding

---

## Matriz prioridad vs esfuerzo

| Iniciativa | Impacto | Esfuerzo | Trimestre |
|------------|---------|----------|-----------|
| TrackPro AI tools+ | ⭐⭐⭐⭐⭐ | M | Q2 2026 |
| KPI dashboard | ⭐⭐⭐⭐ | M | Q2 2026 |
| Anomalías | ⭐⭐⭐⭐⭐ | L | Q3 2026 |
| Playbooks | ⭐⭐⭐⭐⭐ | L | Q3-Q4 2026 |
| API pública | ⭐⭐⭐⭐ | M | Q4 2026 |
| Route optimization | ⭐⭐⭐ | L | Q4 2026 |
| IoT telemetry | ⭐⭐⭐⭐ | M | Q4 2026 |
| Video | ⭐⭐⭐ | XL | 2027 |
| 1M scale | ⭐⭐⭐⭐⭐ | XL | 2027+ |

---

## Métricas de éxito

| KPI negocio | Target 2027 |
|-------------|-------------|
| Dispositivos activos | 10,000+ |
| Empresas pagando | 200+ |
| NRR | >110% |
| Uptime plataforma | 99.9% |
| NPS admin | >40 |

| KPI técnico | Target 2027 |
|-------------|-------------|
| AI queries/día | 5,000+ |
| API calls/día | 50,000+ |
| P95 ingest lag | <2s |
| Costo IA / empresa | <$5/mes avg |

---

## Qué NO hacer (anti-patterns)

- Reescribir gps-server en otro lenguaje prematuramente
- Mover todo a microservicios antes de 50k devices
- SQL libre generado por LLM sin validación
- IA en hot path TCP
- Breaking changes en `/api/mobile/*` v1

---

## Próximo paso inmediato

**Aprobación para implementar Fase 2A TrackPro AI:**
1. Migración `ai_conversations`
2. 5 tools nuevas en `/api/ai/chat`
3. UI historial chat
4. Deploy Vercel

---

*Roadmap vivo — revisar al cierre de cada trimestre.*  
*Índice: [`TRACKPRO_ENTERPRISE.md`](./TRACKPRO_ENTERPRISE.md)*
