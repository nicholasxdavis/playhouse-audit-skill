# Playhouse Audit Skill

Run a lean deploy quality gate: Lighthouse 100s (mobile + desktop median), image compression, and a copy gate with zero em dashes and zero emoji[cite: 1].

## Overview

This skill focuses on measure, fix, re-measure. It keeps one summary artifact by default and deletes run bloat after each pass. It is not a design system and not a mascot factory[cite: 1].

## Installation

Add this skill folder to your agent configuration directory or reference it directly in your workspace instructions. Copy `templates/playhouse-deploy.yml` into the project so the gate runs on every deployment.

## When to Use

* Chasing Lighthouse / PageSpeed / Core Web Vitals scores
* Pre-launch or every-deploy quality gating
* Compressing images that hurt LCP
* Scrubbing shipped copy for em dashes and emoji
