# ⚠️ DEPRECATED — do not build on this

This directory is a **dead parallel implementation** that nothing in the
running system calls. The active pipeline is:

```
frontend (Next.js) → backend/ (Express gateway, :4000) → formatter-service/ (FastAPI, :8082)
```

The frontend used to (incorrectly) post to this service on :8000; that was
fixed — `frontend/src/lib/api.ts` now targets the Express gateway on :4000
(`NEXT_PUBLIC_API_BASE` overrides it).

All formatting work happens in `formatter-service/formatting/`. This folder
is kept only for the historical analysis scripts it contains and may be
deleted at any time.
