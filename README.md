# 🎟️ KineticAuth

### Embodied Motion Verification for Fair Ticket Access

---

## The Problem

High-demand ticket releases force fans to compete against automated bots operating at superhuman speed.

Traditional defenses like CAPTCHA, SMS verification, and identity uploads either:

* Add friction for legitimate users
* Or fail against increasingly sophisticated automation

Ticketing needs a system that protects fairness without punishing real fans.

---

## Our Insight

Bots simulate logic.
Humans inhabit motion.

Automation can replicate clicks.

It cannot replicate embodied, real-time device movement.

KineticAuth leverages that asymmetry.

---

## What We Built

KineticAuth is an adaptive, motion-based authentication layer designed for high-traffic ticket onsales.

Instead of static puzzles or biometric ID checks, we verify physical presence using device motion.

Security becomes interaction.

---

## How It Works

### 1️⃣ Baseline Tilt Verification

Users complete a lightweight tilt interaction.

We measure:

* Orientation stability
* Motion smoothness
* Completion timing

If motion falls within human thresholds → access granted immediately.

Most fans never experience additional friction.

---

### 2️⃣ Adaptive Risk Engine

If motion patterns are inconsistent:

TILT → ANALYZING → STEP-UP

Step-up activates only when elevated risk is detected 

---

### 3️⃣ Rhythmic Step-Up

Escalated users complete a shake-to-beat challenge.

This tests:

* Sustained motion consistency
* Reaction timing
* Real-time embodied engagement

Bots cannot convincingly replicate rhythmic motion under live constraints.

---

## Privacy by Design

* No biometric identity storage
* No facial recognition
* No personal data retention
* Motion processed locally
* Data discarded after verification

We verify physical presence — not identity.

---

## Why It’s Different

Most systems rely on:

* AI classifiers
* Identity checks
* Static puzzles

KineticAuth introduces:

**Embodied verification.**

Low friction for real fans.
Escalation only when risk increases.
Security without surveillance.

---

## Deployment on DigitalOcean

KineticAuth is configured for seamless deployment on DigitalOcean's App Platform.

### Quick Start

1. **Connect your GitHub repository** to DigitalOcean App Platform
2. **Select the main branch** for automatic deployments
3. **Review the `app.yaml` configuration** - it specifies:
   - Node.js runtime environment
   - Build command: `npm run build`
   - Start command: `npm start`
   - Environment variables for production
4. **Deploy** - DigitalOcean automatically builds and deploys on each push to main

### Configuration

The `app.yaml` file in the repository root contains:
- Service configuration for the Next.js application
- Static site routing for public assets
- Environment variable definitions
- Build and run commands optimized for production

### Environment Variables

Ensure these are set in your DigitalOcean App:
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL` - Will be auto-populated with your app domain

### Deployment Status

View deployment logs and manage your app at:
https://cloud.digitalocean.com/apps
