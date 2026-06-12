---
marp: true
theme: phosphor2600
paginate: true
title: Demo rendu
header: 'john@2600:~/renduz/demo$'
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Demo rendu

École 2600 — 3D soutenance template
**github.com/johnfr15**

---

## 01 / Architecture

A small stylized infrastructure, modeled in `scene.js`:

- **gateway** — entry point, exposed to the internet
- **firewall** — filters everything crossing the stage
- **api** — three service towers
- **db** — the stacked data store

*Each next slide flies the camera to one of them.*

---

## 02 / Gateway

The **gateway** is the only component facing outside.

- Terminates TLS
- Routes by hostname
- Watch the packets leaving it on the cables

---

## 03 / Firewall

Every packet crosses the **firewall** wall.

```text
default: DROP
allow:   443/tcp → api
allow:   5432/tcp api → db
```

---

## 04 / API servers

Three **api** towers behind the wall.

- Stateless, horizontally scaled
- The glowing stripes are very scientific load indicators

---

## 05 / Database

The **db** keeps the state — stacked disks, classic icon style.

- One writer, replicas below
- Only reachable from the api segment

---

<!-- _class: invert -->
<!-- _paginate: false -->

# Fin

Back to the **overview** — questions?
**johnfr15.github.io**
