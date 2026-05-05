import React, { useEffect, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import {
  saveImageBlob,
  getImageBlob,
  deleteImageBlob,
  clearImageStore,
  resizeImageFile,
  objectUrlFromBlob,
} from "./imageStore";
import { smartNativeShare } from "./nativeShare";
import { auth, db } from "./firebase";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import appLogo from "./assets/app-logo.png";
import "./style.css";

const APP_VERSION = "1.0.0";
const STORAGE_KEY = "k7-eats-restaurants-v3";
const LEGACY_RESTAURANT_KEYS = ["k7-eats-restaurants-v2", "k7-eats-restaurants", "restaurant-finder-restaurants"];
const SETTINGS_BACKUP_KEY = "k7-eats-settings-backup-v1";
const APK_PROMO_LINK = "https://github.com/k7artwork-afk/restaurant-discovery-planner/releases/latest";
const USER_PROFILE_KEY = "k7-eats-user-profile";
const THEME_KEY = "restaurant-finder-theme";
const THEME_OPTIONS = ["orange", "light", "charcoal"];
const HOME_THEME_CYCLE = ["orange", "light", "charcoal"];
const DISCOVERY_KEY = "restaurant-finder-discovery-categories";

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function getSystemThemePreference() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getStoredThemeMode() {
  const savedTheme = safeGetStorage(THEME_KEY);
  return THEME_OPTIONS.includes(savedTheme) ? savedTheme : "orange";
}

function resolveThemeMode(mode) {
  if (mode === "dark") return "charcoal";
  return THEME_OPTIONS.includes(mode) ? mode : "orange";
}

function backupUserStorageSnapshot(restaurants, profile, theme, discoveryCategories) {
  safeSetStorage(
    SETTINGS_BACKUP_KEY,
    JSON.stringify({
      restaurants,
      profile,
      theme,
      discoveryCategories,
      savedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
    })
  );
}

function loadUserProfile() {
  try {
    const saved = safeGetStorage(USER_PROFILE_KEY);
    if (!saved) return { name: "", avatar: "male" };
    const parsed = JSON.parse(saved);
    return {
      name: parsed.name || "",
      avatar: parsed.avatar || "male",
    };
  } catch {
    return { name: "", avatar: "male" };
  }
}

function getAvatarEmoji(avatar) {
  if (avatar === "female") return "👩";
  if (avatar === "neutral") return "🧑";
  return "👨";
}

const STATUS = { PLANNED: "planned", PENDING: "pending", VISITED: "visited" };

const RESTAURANT_KEYWORDS = [
  "restaurant",
  "resto",
  "cafe",
  "cafeteria",
  "grill",
  "kitchen",
  "biryani",
  "pizza",
  "burger",
  "bakery",
  "shawarma",
  "mandi",
  "beirut",
  "kebab",
  "steak",
  "sushi",
  "dining",
  "food",
  "eatery",
  "bbq",
  "seafood",
];

const SKIP_WORDS = [
  "overview",
  "menu",
  "reviews",
  "photos",
  "call",
  "directions",
  "website",
  "share",
  "order pickup",
  "order delivery",
  "whatsapp",
  "google",
  "maps",
  "open",
  "closed",
  "hours",
  "rating",
  "stars",
  "km",
  "mins",
  "route",
  "save",
  "nearby",
  "popular",
  "sponsored",
  "view all",
  "detect restaurant",
  "detected",
  "review before saving",
  "enter file",
];

const DEFAULT_DISCOVER_CATEGORIES = [
  { label: "Near me", icon: "📍", query: "restaurants near me" },
  { label: "Cafes", icon: "☕", query: "cafes near me" },
  { label: "Family", icon: "👨‍👩‍👧", query: "family restaurant near me" },
  { label: "Fine dining", icon: "🍷", query: "fine dining near me" },
  { label: "Indian", icon: "🍛", query: "Indian restaurants near me" },
  { label: "Vegetarian", icon: "🥗", query: "vegetarian restaurants near me" },
  { label: "Biryani", icon: "🍚", query: "biryani near me" },
  { label: "Desserts", icon: "🍰", query: "dessert cafe near me" },
];

function loadDiscoveryCategories() {
  try {
    const saved = safeGetStorage(DISCOVERY_KEY);
    if (!saved) return DEFAULT_DISCOVER_CATEGORIES;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_DISCOVER_CATEGORIES;
  } catch {
    return DEFAULT_DISCOVER_CATEGORIES;
  }
}

const DISCOVER_SUGGESTIONS = [
  { title: "Dinner with family", detail: "Find family restaurants around you", query: "best family restaurant near me" },
  { title: "Quick coffee stop", detail: "Find cafes near your current location", query: "best cafe near me" },
  { title: "Weekend fine dining", detail: "Explore premium dining options", query: "fine dining restaurant near me" },
];

const DISCOVERY_RESTAURANT_CATALOG = [
  { name: "MyGovinda's", area: "Jumeirah Lake Towers, Dubai", cuisine: "Vegetarian Indian", rating: "4.2", distance: "1.1 km", tags: ["vegetarian", "indian", "family", "jlt"], menu: ["veg thali", "paneer", "chaat", "vegetarian meals"], trust: "Tag match + nearby" },
  { name: "Kamat Vegetarian", area: "Jumeirah Lake Towers, Dubai", cuisine: "Vegetarian", rating: "4.3", distance: "1.6 km", tags: ["vegetarian", "indian", "family", "jlt"], menu: ["dosa", "idli", "veg thali", "paneer", "vegetarian meals"], trust: "Cuisine match" },
  { name: "Saravanaa Bhavan", area: "Dubai", cuisine: "South Indian Vegetarian", rating: "4.1", distance: "2.2 km", tags: ["vegetarian", "indian", "family", "south indian"], menu: ["dosa", "idli", "vada", "meals", "veg biryani"], trust: "Vegetarian specialist" },
  { name: "Veg World Restaurant", area: "Karama, Dubai", cuisine: "Vegetarian Indian", rating: "4.0", distance: "3.0 km", tags: ["vegetarian", "indian", "budget"], menu: ["veg thali", "dosa", "paneer", "chaat"], trust: "Vegetarian option" },
  { name: "Al Safadi Restaurant", area: "Jumeirah, Dubai", cuisine: "Lebanese", rating: "4.5", distance: "2.4 km", tags: ["family", "near me", "fine dining", "lebanese"], menu: ["grills", "shawarma", "hummus", "mixed grill"], trust: "Popular family dining" },
  { name: "Allo Beirut", area: "JBR, Dubai", cuisine: "Lebanese", rating: "4.6", distance: "2.9 km", tags: ["family", "near me", "casual", "lebanese"], menu: ["shawarma", "falafel", "manakish", "grills"], trust: "High rating" },
  { name: "Bait Al Mandi Restaurant", area: "Al Rigga, Dubai", cuisine: "Arabic / Mandi", rating: "4.4", distance: "3.2 km", tags: ["family", "biryani", "near me", "rice"], menu: ["chicken mandi", "mutton mandi", "biryani", "kabsa"], trust: "Cuisine match" },
  { name: "Biryani Pot", area: "Dubai Marina", cuisine: "Biryani / Indian", rating: "4.0", distance: "1.8 km", tags: ["biryani", "indian", "near me", "rice"], menu: ["chicken biryani", "mutton biryani", "veg biryani"], trust: "Tag match" },
  { name: "Pak Liyari", area: "Deira, Dubai", cuisine: "Pakistani / Biryani", rating: "4.4", distance: "3.5 km", tags: ["biryani", "pakistani", "rice"], menu: ["beef biryani", "chicken biryani", "mutton biryani"], trust: "Menu match" },
  { name: "Student Biryani", area: "Dubai", cuisine: "Pakistani / Biryani", rating: "4.1", distance: "2.8 km", tags: ["biryani", "pakistani", "family"], menu: ["chicken biryani", "beef biryani", "veg biryani"], trust: "Menu match" },
  { name: "Gazebo", area: "Jumeirah Lake Towers, Dubai", cuisine: "Indian", rating: "4.2", distance: "2.0 km", tags: ["indian", "family", "biryani"], menu: ["dum biryani", "murgh biryani", "paneer", "kebab"], trust: "Menu match" },
  { name: "Laffah Restaurant", area: "Dubai", cuisine: "Shawarma / Arabic", rating: "4.3", distance: "2.0 km", tags: ["laffah", "shawarma", "arabic", "family", "near me"], menu: ["shawarma", "broasted chicken", "grills"], trust: "Name match" },
  { name: "KFC", area: "Jumeirah Lake Towers, Dubai", cuisine: "Fried Chicken / Fast Food", rating: "4.1", distance: "1.4 km", tags: ["kfc", "fried chicken", "fast food", "burger", "family", "near me"], menu: ["fried chicken", "zinger burger", "chicken bucket", "twister wrap", "fries"], brand: "kfc", trust: "Name match" },
  { name: "KFC", area: "Dubai Marina", cuisine: "Fried Chicken / Fast Food", rating: "4.0", distance: "1.9 km", tags: ["kfc", "fried chicken", "fast food", "burger", "near me"], menu: ["fried chicken", "zinger", "bucket meal", "burger", "fries"], brand: "kfc", trust: "Name match" },
  { name: "Pizza Hut", area: "Jumeirah Lake Towers, Dubai", cuisine: "Pizza / Fast Food", rating: "4.1", distance: "1.2 km", tags: ["pizza hut", "pizzahut", "pizza", "fast food", "family", "near me"], menu: ["pepperoni pizza", "margherita pizza", "pan pizza", "cheese pizza", "wings", "pasta"], brand: "pizza hut", aliases: ["pizzahut", "pizza hut"], trust: "Exact brand match" },
  { name: "Pizza Hut", area: "Dubai Marina", cuisine: "Pizza / Fast Food", rating: "4.0", distance: "1.8 km", tags: ["pizza hut", "pizzahut", "pizza", "fast food", "delivery"], menu: ["pan pizza", "stuffed crust", "margherita", "pepperoni", "garlic bread"], brand: "pizza hut", aliases: ["pizzahut", "pizza hut"], trust: "Exact brand match" },
  { name: "Domino's Pizza", area: "JLT, Dubai", cuisine: "Pizza / Fast Food", rating: "4.0", distance: "1.7 km", tags: ["pizza", "dominos", "fast food", "delivery"], menu: ["pepperoni pizza", "veggie pizza", "chicken pizza", "garlic bread"], brand: "dominos", aliases: ["domino", "dominos", "domino's"], trust: "Pizza option" },
  { name: "Papa Johns", area: "Dubai Marina", cuisine: "Pizza / Fast Food", rating: "4.1", distance: "2.0 km", tags: ["pizza", "papa johns", "fast food", "family"], menu: ["cheese pizza", "pepperoni", "chicken ranch pizza", "garlic knots"], brand: "papa johns", aliases: ["papa john", "papa johns"], trust: "Pizza option" },
  { name: "Project Chaiwala", area: "JLT, Dubai", cuisine: "Cafe", rating: "4.4", distance: "1.3 km", tags: ["cafes", "coffee", "desserts", "jlt"], menu: ["chai", "coffee", "snacks", "desserts"], trust: "Cafe match" },
  { name: "Brunch & Cake", area: "Jumeirah Islands, Dubai", cuisine: "Cafe / Desserts", rating: "4.3", distance: "2.7 km", tags: ["cafes", "desserts", "family"], menu: ["coffee", "cake", "breakfast", "desserts"], trust: "Category match" },
  { name: "Texas Chicken", area: "Meadows, Dubai", cuisine: "Fast Food", rating: "4.1", distance: "2.1 km", tags: ["near me", "family", "fast food"], menu: ["fried chicken", "burger", "wrap"], trust: "Nearby option" },
];

const FRANCHISE_ALIASES = {
  kfc: ["kfc", "kentucky fried chicken"],
  "pizza hut": ["pizza hut", "pizzahut"],
  dominos: ["dominos", "domino", "domino's"],
  "papa johns": ["papa johns", "papa john", "papajohns"],
  mcdonalds: ["mcdonalds", "mcdonald", "mc donald", "mcd"],
  subway: ["subway"],
  starbucks: ["starbucks"],
  hardees: ["hardees", "hardee's"],
  "burger king": ["burger king", "burgerking"],
  "texas chicken": ["texas chicken"],
};

const CATEGORY_SYNONYMS = {
  pizza: ["pizza", "pizzeria", "pepperoni", "margherita", "cheese pizza", "pan pizza"],
  chicken: ["chicken", "fried chicken", "broasted", "zinger", "wings", "bucket"],
  burger: ["burger", "sandwich", "zinger"],
  vegetarian: ["vegetarian", "veg", "veggie", "paneer", "dosa", "idli", "veg thali"],
  biryani: ["biryani", "rice", "dum biryani", "mutton biryani", "chicken biryani"],
  cafe: ["cafe", "coffee", "chai", "tea", "desserts"],
  family: ["family", "casual", "near me"],
};

function normalizeDiscoveryQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/restaurants?|near me|best|around you|find|food/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactDiscoveryText(value = "") {
  return normalizeDiscoveryQuery(value).replace(/\s+/g, "");
}

function detectFranchiseQuery(normalized) {
  const compact = compactDiscoveryText(normalized);
  for (const [brand, aliases] of Object.entries(FRANCHISE_ALIASES)) {
    if (aliases.some((alias) => {
      const normalizedAlias = normalizeDiscoveryQuery(alias);
      return normalized.includes(normalizedAlias) || compact.includes(compactDiscoveryText(alias));
    })) {
      return brand;
    }
  }
  return "";
}

function expandDiscoveryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    (CATEGORY_SYNONYMS[token] || []).forEach((item) => expanded.add(normalizeDiscoveryQuery(item)));
  }
  return [...expanded].filter(Boolean);
}

function getMatchReason(item, token, field, franchiseMatch = false) {
  if (franchiseMatch) return "Brand match";
  if (field === "name") return "Name match";
  if (field === "cuisine") return "Cuisine match";
  if (field === "menu") return "Menu match";
  if (field === "tags") return "Tag match";
  if (field === "area") return "Location match";
  return item.trust || "Relevant result";
}

function scoreDiscoveryRestaurant(item, query) {
  const normalized = normalizeDiscoveryQuery(query);
  const tokens = normalized.split(" ").filter(Boolean);
  if (!tokens.length) return { score: 0, reason: item.trust || "Relevant result" };

  const expandedTokens = expandDiscoveryTokens(tokens);
  const name = String(item.name || "").toLowerCase();
  const area = String(item.area || "").toLowerCase();
  const cuisine = String(item.cuisine || "").toLowerCase();
  const brand = String(item.brand || "").toLowerCase();
  const aliases = (item.aliases || []).map((alias) => String(alias || "").toLowerCase());
  const tags = (item.tags || []).map((tag) => String(tag || "").toLowerCase());
  const menu = (item.menu || []).map((menuItem) => String(menuItem || "").toLowerCase());
  const compactName = compactDiscoveryText(name);
  const compactNormalized = compactDiscoveryText(normalized);
  const queryBrand = detectFranchiseQuery(normalized);

  let score = 0;
  let reason = "";

  const itemBrandMatchesQuery = queryBrand && (
    brand === queryBrand ||
    normalizeDiscoveryQuery(name).includes(queryBrand) ||
    aliases.some((alias) => normalizeDiscoveryQuery(alias).includes(queryBrand))
  );

  if (itemBrandMatchesQuery) {
    score += 260;
    reason = "Brand match";
  }

  if (compactName === compactNormalized) {
    score += 180;
    reason ||= "Exact name match";
  } else if (compactName.includes(compactNormalized)) {
    score += 140;
    reason ||= "Name match";
  }

  const allTokensMatchName = tokens.length > 1 && tokens.every((token) => name.includes(token));
  if (allTokensMatchName) {
    score += 110;
    reason ||= "Name match";
  }

  for (const token of expandedTokens) {
    if (!token) continue;
    if (name.includes(token) || compactName.includes(compactDiscoveryText(token))) {
      score += 48;
      reason ||= getMatchReason(item, token, "name");
    }
    if (cuisine.includes(token)) {
      score += 38;
      reason ||= getMatchReason(item, token, "cuisine");
    }
    if (menu.some((menuItem) => menuItem.includes(token))) {
      score += 36;
      reason ||= getMatchReason(item, token, "menu");
    }
    if (tags.some((tag) => tag.includes(token))) {
      score += 32;
      reason ||= getMatchReason(item, token, "tags");
    }
    if (area.includes(token)) {
      score += 14;
      reason ||= getMatchReason(item, token, "area");
    }
  }

  // If the user clearly searched a franchise, keep same-category results as secondary only.
  if (queryBrand && !itemBrandMatchesQuery) {
    const categoryRelated = expandedTokens.some((token) => cuisine.includes(token) || menu.some((m) => m.includes(token)) || tags.some((t) => t.includes(token)));
    if (categoryRelated) {
      score = Math.min(score, 95);
      reason ||= "Related option";
    } else {
      score = 0;
    }
  }

  const rating = Number(item.rating || 0);
  if (rating) score += rating * 2;
  const distance = Number(String(item.distance || "").replace(/[^0-9.]/g, ""));
  if (distance) score += Math.max(0, 5 - distance);

  return { score, reason: reason || item.trust || "Relevant result" };
}

function getDiscoveryRestaurants(query) {
  const normalized = normalizeDiscoveryQuery(query);
  const neutralCatalog = DISCOVERY_RESTAURANT_CATALOG.map((item) => ({ ...item, saved: false }));
  if (!normalized) return neutralCatalog.slice(0, 8);

  const ranked = neutralCatalog
    .map((item) => {
      const match = scoreDiscoveryRestaurant(item, query);
      return { ...item, score: match.score, trust: match.reason };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 10);
}

function createMapSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function createEmbeddedMapUrl(query) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

function openSafeExternalUrl(url) {
  const cleanUrl = String(url || "");
  if (!/^https:\/\/(www\.)?(google\.com|maps\.google\.com)\//i.test(cleanUrl)) return;
  window.open(cleanUrl, "_blank", "noopener,noreferrer");
}

const UAE_AREAS = [
  "Dubai",
  "Sharjah",
  "Abu Dhabi",
  "Ajman",
  "JLT",
  "Marina",
  "Deira",
  "Bur Dubai",
  "Business Bay",
  "Jumeirah",
  "Al Barsha",
  "Karama",
  "Downtown Dubai",
  "Satwa",
  "Qusais",
  "Mirdif",
  "Al Nahda",
  "DIFC",
  "JVC",
  "JBR",
  "Silicon Oasis",
  "International City",
];

function normalizeStatus(item) {
  if (item.status === "Planned") return STATUS.PLANNED;
  if (item.status === "Visited") return STATUS.VISITED;
  if (item.status === "To choose") return STATUS.PENDING;
  if ([STATUS.PLANNED, STATUS.VISITED, STATUS.PENDING].includes(item.status)) return item.status;
  return item.visitDate && item.visitTime ? STATUS.PLANNED : STATUS.PENDING;
}

function statusLabel(status) {
  if (status === STATUS.PLANNED) return "Planned";
  if (status === STATUS.VISITED) return "Visited";
  return "Pending";
}

function createRestaurantSearchUrl(name, area) {
  const query = `${name || ""} ${area && area !== "Not set" ? area : ""} restaurant`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function createRestaurantMapsUrl(name, area) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${name || ""} ${area || ""}`.trim())}`;
}

function createReviewPhotosUrl(name, area) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    `${name || ""} ${area || ""} restaurant review photos`.trim()
  )}`;
}

function cleanLine(line) {
  return line
    .replace(/[^\p{L}\p{N}&'’.\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeRestaurantName(line) {
  const clean = cleanLine(line);
  const lower = clean.toLowerCase();

  if (clean.length < 3 || clean.length > 60) return false;
  if (SKIP_WORDS.some((word) => lower.includes(word))) return false;
  if (/^\d+(\.\d+)?$/.test(clean)) return false;
  if (/^[^a-zA-Z]+$/.test(clean)) return false;
  if (/\b\d{1,2}:\d{2}\b/.test(clean)) return false;
  if (/\b\d+\s*(reviews?|photos?|min|mins|km|m)\b/i.test(clean)) return false;

  return true;
}

function scoreLine(line, index) {
  const clean = cleanLine(line);
  const lower = clean.toLowerCase();
  let score = 0;

  if (!looksLikeRestaurantName(clean)) return -999;
  if (RESTAURANT_KEYWORDS.some((word) => lower.includes(word))) score += 50;
  if (/^[A-Z][A-Za-z0-9&'’.\-\s]+$/.test(clean)) score += 12;
  const words = clean.split(" ").filter(Boolean).length;
  if (words >= 2 && words <= 5) score += 12;
  if (index <= 6) score += 8;
  if (/[A-Za-z]/.test(clean)) score += 8;
  if (/[ء-ي]/.test(clean)) score += 8;
  if (UAE_AREAS.some((area) => lower.includes(area.toLowerCase()))) score -= 5;
  if (lower.includes("restaurant") || lower.includes("cafe")) score += 15;

  return score;
}

function detectRating(text) {
  const normalized = text.replace(/,/g, ".");
  const starMatch = normalized.match(/\b([1-5](?:\.\d)?)\s*(?:★|☆|\*|%|\()/);
  if (!starMatch) return "";
  const rating = Number(starMatch[1]);
  return rating >= 1 && rating <= 5 ? rating.toFixed(1).replace(/\.0$/, "") : "";
}

function detectArea(text, preferredLine = "") {
  const normalized = text.replace(/\s+/g, " ");
  const fromPreferred = UAE_AREAS.find((area) => new RegExp(`\\b${area}\\b`, "i").test(preferredLine));
  if (fromPreferred) return fromPreferred;

  const dashMatch = preferredLine.match(/[-–—]\s*([A-Za-z][A-Za-z0-9 ]{1,30})$/);
  if (dashMatch) return cleanLine(dashMatch[1]);

  const found = UAE_AREAS.find((area) => new RegExp(`\\b${area}\\b`, "i").test(normalized));
  if (found) return found;

  const inMatch = normalized.match(/\bin\s+([A-Za-z ]{3,30})(?:$|[,.])/i);
  return inMatch ? cleanLine(inMatch[1]) : "Not set";
}

function extractNameFromCandidate(line) {
  let clean = cleanLine(line);

  // Google result screenshots often read like: "Allo Beirut - JBR".
  clean = clean.replace(/\s+[-–—]\s+[A-Za-z0-9 ]{2,30}$/i, "");

  return clean
    .replace(/\b(restaurant|resto|cafe|cafeteria|visit|try|food|dinner|lunch|breakfast)\b$/gi, "")
    .replace(/[:|•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRestaurantText(text) {
  const message = text.trim();
  if (!message) return null;

  const rawLines = message.split(/\n+/).map(cleanLine).filter(Boolean);
  if (!rawLines.length) return null;

  const ranked = rawLines
    .map((line, index) => ({ line, score: scoreLine(line, index) }))
    .filter((item) => item.score > -999)
    .sort((a, b) => b.score - a.score);

  // Prefer a Google/business listing title line with a dash, e.g. "Allo Beirut - JBR".
  const titleLine = rawLines.find((line) => {
    const lower = line.toLowerCase();
    return /\s[-–—]\s/.test(line)
      && looksLikeRestaurantName(line)
      && !SKIP_WORDS.some((word) => lower.includes(word));
  });

  const chosenLine = titleLine || ranked[0]?.line || rawLines[0];
  let best = extractNameFromCandidate(chosenLine);

  if (!best || SKIP_WORDS.some((word) => best.toLowerCase().includes(word))) {
    const fallback = ranked.find((item) => !SKIP_WORDS.some((word) => item.line.toLowerCase().includes(word)))?.line;
    best = fallback ? extractNameFromCandidate(fallback) : "Restaurant";
  }

  return {
    name: best,
    area: detectArea(message, chosenLine),
    rating: detectRating(message),
    notes: "",
    confidence: Math.max(0, Math.min(100, ranked[0]?.score || 30)),
  };
}

function createRestaurantShareText(item) {
  const status = statusLabel(normalizeStatus(item));
  const visitLine = item.visitDate || item.visitTime
    ? `
Visit plan: ${item.visitDate || "Date not set"} ${item.visitTime || ""}`.trimEnd()
    : "";

  return `Check this restaurant 👇

${item.name}
Location: ${item.area || "Location not detected"}
Status: ${status}${visitLine}

Open/Search:
${item.searchUrl || createRestaurantSearchUrl(item.name, item.area)}

Shared from Restaurant Finder and Planner by K7Artwork.AI.
Download the APK:
${APK_PROMO_LINK}`;
}

function isValidRestaurantRecord(item) {
  return item && typeof item === "object" && typeof item.name === "string" && item.name.trim().length > 0;
}

function normalizeRestaurantRecord(item) {
  const name = String(item.name || "").trim();
  const area = String(item.area || "Not set").trim() || "Not set";

  return {
    ...item,
    id: String(item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name,
    area,
    notes: String(item.notes || ""),
    rating: String(item.rating || ""),
    source: String(item.source || "Saved"),
    visitDate: String(item.visitDate || ""),
    visitTime: String(item.visitTime || ""),
    status: normalizeStatus(item),
    favorite: Boolean(item.favorite),
    thumbnailUrl: String(item.thumbnailUrl || ""),
    thumbnailKey: String(item.thumbnailKey || ""),
    searchUrl: item.searchUrl || createRestaurantSearchUrl(name, area),
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function readRestaurantListFromKey(key) {
  const saved = safeGetStorage(key);
  if (saved === null) return null;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isValidRestaurantRecord).map(normalizeRestaurantRecord) : [];
  } catch {
    return [];
  }
}

function loadStoredRestaurants() {
  const current = readRestaurantListFromKey(STORAGE_KEY);
  if (current !== null) return current;

  for (const key of LEGACY_RESTAURANT_KEYS) {
    const migrated = readRestaurantListFromKey(key);
    if (migrated !== null) {
      safeSetStorage(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }

  return [];
}


function getRestaurantIdentity(item) {
  return `${String(item?.name || "").trim().toLowerCase()}|${String(item?.area || "").trim().toLowerCase()}`;
}

function mergeRestaurantLists(localList = [], cloudList = []) {
  const merged = new Map();

  [...cloudList, ...localList]
    .filter(isValidRestaurantRecord)
    .map(normalizeRestaurantRecord)
    .forEach((item) => {
      const key = getRestaurantIdentity(item);
      if (!key || key === "|") return;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, item);
        return;
      }

      const existingTime = Date.parse(existing.createdAt || "") || 0;
      const itemTime = Date.parse(item.createdAt || "") || 0;
      merged.set(key, itemTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing });
    });

  return Array.from(merged.values()).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function sanitizeRestaurantsForCloud(items = []) {
  return items
    .filter(isValidRestaurantRecord)
    .map(normalizeRestaurantRecord)
    .map(({ id, name, area, notes, rating, source, visitDate, visitTime, status, favorite, thumbnailUrl, thumbnailKey, searchUrl, createdAt }) => ({
      id,
      name,
      area,
      notes,
      rating,
      source,
      visitDate,
      visitTime,
      status,
      favorite,
      thumbnailUrl,
      thumbnailKey,
      searchUrl,
      createdAt,
    }));
}

async function loadCloudRestaurants(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return [];
  const restaurants = snap.data()?.savedRestaurants;
  return Array.isArray(restaurants) ? restaurants.filter(isValidRestaurantRecord).map(normalizeRestaurantRecord) : [];
}

async function saveCloudRestaurants(userId, restaurants, profile) {
  await setDoc(doc(db, "users", userId), {
    savedRestaurants: sanitizeRestaurantsForCloud(restaurants),
    profile: {
      name: profile?.name || "",
      avatar: profile?.avatar || "male",
    },
    updatedAt: serverTimestamp(),
    appVersion: APP_VERSION,
  }, { merge: true });
}

async function smartShare({ title, text, url }) {
  return smartNativeShare({ title, text, url });
}

function AppLogo({ profile }) {
  return (
    <div className="brand-lockup">
      {typeof appLogo !== "undefined" ? (
        <img className="app-logo-mark" src={appLogo} alt="Restaurant Finder and Planner" />
      ) : (
        <div className="user-avatar">{getAvatarEmoji(profile.avatar)}</div>
      )}
      <div>
        <p className="simple-greeting">Hello, {profile.name} 👋</p>
      </div>
    </div>
  );
}

function ThemeIconToggle({ resolvedTheme, onToggle }) {
  const nextTheme = HOME_THEME_CYCLE[(HOME_THEME_CYCLE.indexOf(resolvedTheme) + 1) % HOME_THEME_CYCLE.length] || "orange";
  const themeIcon = resolvedTheme === "charcoal" ? "🌑" : resolvedTheme === "light" ? "☀️" : "🟠";
  const themeLabel = resolvedTheme === "charcoal" ? "Dark charcoal" : resolvedTheme === "orange" ? "Orange" : "Light";
  return (
    <button
      className={`theme-icon-toggle theme-icon-toggle--${resolvedTheme}`}
      type="button"
      onClick={onToggle}
      aria-label={`Current theme: ${themeLabel}. Switch to ${nextTheme} mode`}
      title={`Current theme: ${themeLabel}. Switch to ${nextTheme} mode`}
    >
      <span className="theme-icon-toggle__orb" aria-hidden="true">{themeIcon}</span>
    </button>
  );
}


function PremiumSplash({ visible }) {
  return (
    <div className={`premium-splash ${visible ? "" : "premium-splash--hide"}`} aria-hidden={!visible}>
      <div className="premium-splash__glow" />
      <div className="premium-splash__logo-wrap">
        <img className="premium-splash__logo" src={appLogo} alt="Restaurant Finder and Planner" />
        <span className="premium-splash__ring" />
        <span className="premium-splash__shine" />
      </div>
      <p className="premium-splash__title">Restaurant Finder and Planner</p>
    </div>
  );
}

function RestaurantRow({
  item,
  thumbnailUrl,
  onUpdateVisit,
  onRemove,
  onToggleFavorite,
  onMarkVisited,
  onMarkPlanned,
  onShare,
}) {
  const status = normalizeStatus(item);

  return (
    <article className="restaurant-row">
      <div className="row-thumb">
        {thumbnailUrl || item.thumbnailUrl ? (
          <img src={thumbnailUrl || item.thumbnailUrl} alt={item.name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <span>{item.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      <div className="row-main">
        <div className="row-top">
          <h3>{item.name}</h3>
          <button className="heart-button" onClick={() => onToggleFavorite(item.id)}>
            {item.favorite ? "❤️" : "🤍"}
          </button>
        </div>

        <p>{item.area}</p>
        {item.rating && <p className="row-rating">⭐ {item.rating}</p>}

        <div className="row-actions">
          <strong className={status}>{statusLabel(status)}</strong>
          <a href={item.searchUrl || createRestaurantSearchUrl(item.name, item.area)} target="_blank" rel="noopener noreferrer">Search</a>
          <a href={createRestaurantMapsUrl(item.name, item.area)} target="_blank" rel="noopener noreferrer">Maps</a>
          <a href={createReviewPhotosUrl(item.name, item.area)} target="_blank" rel="noopener noreferrer">Photos</a>
        </div>
      </div>

      <div className="row-divider" aria-hidden="true" />

      <div className="row-plan">
        <input type="date" value={item.visitDate || ""} onChange={(e) => onUpdateVisit(item.id, "visitDate", e.target.value)} />
        <input type="time" value={item.visitTime || ""} onChange={(e) => onUpdateVisit(item.id, "visitTime", e.target.value)} />
        <button type="button" className="card-action-button visited-button" onClick={() => onMarkVisited(item.id)}>{status === STATUS.VISITED ? "↩ Mark Unvisited" : "✓ Mark Visited"}</button>
        <button type="button" className="card-action-button planned-button" onClick={() => onMarkPlanned(item.id)}>📅 Plan Visit</button>
        <button type="button" className="card-action-button delete-button" onClick={() => onRemove(item.id)}>×</button>
        <button type="button" className="card-action-button share-button" onClick={() => onShare(item)}>📤 Share</button>
      </div>
    </article>
  );
}

export default function App() {
  const [restaurants, setRestaurants] = useState(loadStoredRestaurants);
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [query, setQuery] = useState("");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [newDiscovery, setNewDiscovery] = useState({ label: "", query: "" });
  const [discoveryCategories, setDiscoveryCategories] = useState(loadDiscoveryCategories);
  const [addedDiscoveryLabel, setAddedDiscoveryLabel] = useState("");
  const [removingDiscoveryLabels, setRemovingDiscoveryLabels] = useState([]);
  const [mainTab, setMainTab] = useState("home");
  const [listFilter, setListFilter] = useState("all");
  const [sortMode, setSortMode] = useState("newest");
  const [manual, setManual] = useState({ name: "", area: "", notes: "", thumbnailUrl: "" });
  const [galleryImage, setGalleryImage] = useState(null);
  const [galleryThumbnailKey, setGalleryThumbnailKey] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedRestaurant, setDetectedRestaurant] = useState(null);
  const [toast, setToast] = useState("");
  const [userProfile, setUserProfile] = useState(loadUserProfile);
  const [profileDraft, setProfileDraft] = useState(() => loadUserProfile());
  const [theme, setTheme] = useState(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveThemeMode(getStoredThemeMode()));
  const [showSplash, setShowSplash] = useState(true);
  const [discoverySheet, setDiscoverySheet] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("Not signed in");
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const restaurantsRef = useRef(restaurants);
  const profileRef = useRef(userProfile);

  useEffect(() => {
    restaurantsRef.current = restaurants;
    safeSetStorage(STORAGE_KEY, JSON.stringify(restaurants));
  }, [restaurants]);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user || null);
      setCloudReady(false);

      if (!user) {
        setCloudStatus("Not signed in");
        setIsCloudBusy(false);
        return;
      }

      setIsCloudBusy(true);
      setCloudStatus("Syncing cloud data...");

      try {
        const cloudRestaurants = await loadCloudRestaurants(user.uid);
        const merged = mergeRestaurantLists(restaurantsRef.current, cloudRestaurants);
        setRestaurants(merged);
        safeSetStorage(STORAGE_KEY, JSON.stringify(merged));
        await saveCloudRestaurants(user.uid, merged, profileRef.current);
        setCloudReady(true);
        setCloudStatus(`Synced as ${user.displayName || user.email || "Google user"}`);
      } catch (error) {
        console.error("Firebase load failed", error);
        setCloudStatus("Cloud sync failed. Local data is safe.");
      } finally {
        setIsCloudBusy(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !cloudReady) return undefined;

    const timer = window.setTimeout(async () => {
      try {
        setCloudStatus("Saving to cloud...");
        await saveCloudRestaurants(firebaseUser.uid, restaurants, userProfile);
        setCloudStatus(`Cloud backup active: ${firebaseUser.displayName || firebaseUser.email || "signed in"}`);
      } catch (error) {
        console.error("Firebase save failed", error);
        setCloudStatus("Cloud backup failed. Local data is safe.");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [restaurants, userProfile, firebaseUser, cloudReady]);

  useEffect(() => {
    let active = true;
    const createdUrls = [];

    async function loadThumbnailUrls() {
      const entries = await Promise.all(
        restaurants
          .filter((item) => item.thumbnailKey)
          .map(async (item) => {
            try {
              const blob = await getImageBlob(item.thumbnailKey);
              if (!blob) return null;
              const url = objectUrlFromBlob(blob);
              createdUrls.push(url);
              return [item.id, url];
            } catch {
              return null;
            }
          })
      );

      if (!active) return;
      setThumbnailUrls(Object.fromEntries(entries.filter(Boolean)));
    }

    loadThumbnailUrls();

    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [restaurants]);

  useEffect(() => {
    const applyTheme = () => {
      const nextResolvedTheme = resolveThemeMode(theme);
      setResolvedTheme(nextResolvedTheme);
      document.documentElement.dataset.theme = nextResolvedTheme;
      document.documentElement.dataset.themeMode = theme;
      safeSetStorage(THEME_KEY, theme);
    };

    applyTheme();

    return undefined;
  }, [theme]);

  useEffect(() => {
    safeSetStorage(DISCOVERY_KEY, JSON.stringify(discoveryCategories));
  }, [discoveryCategories]);

  useEffect(() => {
    backupUserStorageSnapshot(restaurants, userProfile, theme, discoveryCategories);
  }, [restaurants, userProfile, theme, discoveryCategories]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1650);
    return () => clearTimeout(timer);
  }, []);

  const totalCount = restaurants.length;
  const plannedCount = restaurants.filter((r) => normalizeStatus(r) === STATUS.PLANNED).length;
  const pendingCount = restaurants.filter((r) => normalizeStatus(r) === STATUS.PENDING).length;
  const visitedCount = restaurants.filter((r) => normalizeStatus(r) === STATUS.VISITED).length;
  const favoriteCount = restaurants.filter((r) => r.favorite).length;

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    let items = restaurants;

    if (listFilter === STATUS.PLANNED) items = items.filter((item) => normalizeStatus(item) === STATUS.PLANNED);
    if (listFilter === STATUS.PENDING) items = items.filter((item) => normalizeStatus(item) === STATUS.PENDING);
    if (listFilter === STATUS.VISITED) items = items.filter((item) => normalizeStatus(item) === STATUS.VISITED);
    if (listFilter === "favorites") items = items.filter((item) => item.favorite);

    if (queryTokens.length > 0) {
      items = items.filter((item) => {
        const searchableText = [
          item.name,
          item.area,
          item.notes,
          item.source,
          item.rating,
          item.visitDate,
          item.visitTime,
          statusLabel(normalizeStatus(item)),
          item.favorite ? "favorite fav saved" : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return queryTokens.every((token) => searchableText.includes(token));
      });
    }

    const sorted = [...items];
    if (sortMode === "plannedDate") {
      sorted.sort((a, b) => (a.visitDate || "9999-99-99").localeCompare(b.visitDate || "9999-99-99"));
    } else if (sortMode === "favorites") {
      sorted.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
    } else if (sortMode === "visitedLast") {
      sorted.sort((a, b) => Number(normalizeStatus(a) === STATUS.VISITED) - Number(normalizeStatus(b) === STATUS.VISITED));
    } else {
      sorted.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    }

    return sorted;
  }, [restaurants, query, listFilter, sortMode]);

  const recentRestaurants = restaurants.slice(0, 4);

  function openList(filter) {
    setListFilter(filter);
    setMainTab("saved");
  }

  function saveRestaurant(payload) {
    const name = payload.name?.trim();
    if (!name) {
      setToast("Restaurant name required");
      return;
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      area: payload.area?.trim() || "Not set",
      notes: payload.notes?.trim() || "",
      rating: payload.rating?.trim() || "",
      source: payload.source || "Manual entry",
      visitDate: payload.visitDate || "",
      visitTime: payload.visitTime || "",
      status: payload.visitDate && payload.visitTime ? STATUS.PLANNED : STATUS.PENDING,
      favorite: false,
      thumbnailUrl: payload.thumbnailUrl || "",
      thumbnailKey: payload.thumbnailKey || "",
      searchUrl: createRestaurantSearchUrl(name, payload.area),
      createdAt: new Date().toISOString(),
    };

    const duplicate = restaurants.some(
      (r) => r.name.toLowerCase() === item.name.toLowerCase() && r.area.toLowerCase() === item.area.toLowerCase()
    );

    if (duplicate) {
      setToast("Restaurant already saved");
      return;
    }

    setRestaurants([item, ...restaurants]);
    setToast("Restaurant saved");
    setMainTab("saved");
    setListFilter("all");
  }

  function addManual() {
    if (!manual.name?.trim()) {
      setToast("Restaurant name required");
      return;
    }
    saveRestaurant({ ...manual, source: "Manual entry" });
    setManual({ name: "", area: "", notes: "", thumbnailUrl: "" });
  }

  async function pickGalleryImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setOcrStatus("Optimizing image...");
      setOcrProgress(0);

      const optimizedBlob = await resizeImageFile(file, 1400, 0.84);
      const imageKey = `restaurant-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await saveImageBlob(imageKey, optimizedBlob);

      const imageUrl = objectUrlFromBlob(optimizedBlob);
      setGalleryImage(imageUrl);
      setGalleryThumbnailKey(imageKey);
      setDetectedRestaurant(null);
      setOcrStatus("Image selected. Tap Detect Restaurant.");
    } catch (err) {
      setOcrStatus(`Image load failed: ${err.message}`);
    }
  }

  async function readRestaurantFromImage() {
    if (!galleryImage) return;

    setOcrStatus("Preparing OCR engine...");
    setOcrProgress(0);
    setIsScanning(true);

    let worker;
    try {
      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status) setOcrStatus(m.status);
          if (typeof m.progress === "number") setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const result = await worker.recognize(galleryImage);
      const text = result.data.text || "";
      const parsed = parseRestaurantText(text);

      setOcrText(text);
      setDetectedRestaurant(parsed);
      setOcrStatus(parsed ? "Detected. Review before saving." : "Could not detect restaurant. Try a clearer screenshot.");
    } catch (err) {
      setOcrStatus(`OCR failed: ${err.message}`);
    } finally {
      if (worker) await worker.terminate();
      setIsScanning(false);
    }
  }

  function saveDetectedRestaurant() {
    if (!detectedRestaurant?.name) {
      setToast("No restaurant detected");
      return;
    }

    saveRestaurant({
      ...detectedRestaurant,
      source: "Gallery OCR",
      thumbnailKey: galleryThumbnailKey,
      thumbnailUrl: "",
    });

    if (galleryImage) URL.revokeObjectURL(galleryImage);
    setGalleryImage(null);
    setGalleryThumbnailKey("");
    setDetectedRestaurant(null);
    setOcrStatus("");
    setOcrProgress(0);
  }

  function updateVisit(id, field, value) {
    const next = restaurants.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (normalizeStatus(updated) !== STATUS.VISITED) {
        updated.status = updated.visitDate && updated.visitTime ? STATUS.PLANNED : STATUS.PENDING;
      }
      return updated;
    });
    setRestaurants(next);
    setToast("Plan updated");
  }

  function toggleFavorite(id) {
    setRestaurants((items) => items.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)));
  }


  function toggleThemeFromHome() {
    const currentIndex = HOME_THEME_CYCLE.indexOf(resolvedTheme);
    const nextTheme = HOME_THEME_CYCLE[(currentIndex + 1) % HOME_THEME_CYCLE.length] || "orange";
    setTheme(nextTheme);
  }

  function toggleVisited(id) {
    setRestaurants((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: normalizeStatus(item) === STATUS.VISITED
                ? (item.visitDate && item.visitTime ? STATUS.PLANNED : STATUS.PENDING)
                : STATUS.VISITED,
            }
          : item
      )
    );
    setToast("Status updated");
  }

  function markPlanned(id) {
    setRestaurants((items) =>
      items.map((item) => (item.id === id ? { ...item, status: item.visitDate && item.visitTime ? STATUS.PLANNED : STATUS.PENDING } : item))
    );
    setToast("Moved back to plan");
  }

  async function removeRestaurant(id) {
    if (!confirm("Delete this restaurant?")) return;
    const target = restaurants.find((item) => item.id === id);
    if (target?.thumbnailKey) await deleteImageBlob(target.thumbnailKey);

    setRestaurants((items) => items.filter((item) => item.id !== id));
    setToast("Restaurant deleted");
  }

  async function clearAll() {
    if (confirm("Delete all restaurants from this phone?")) {
      await clearImageStore();
      setThumbnailUrls({});
      setRestaurants([]);
      setToast("All data cleared");
    }
  }

  function saveProfile() {
    const cleanName = profileDraft.name.trim();
    if (!cleanName) {
      setToast("Please enter your name");
      return;
    }

    const next = {
      name: cleanName,
      avatar: profileDraft.avatar || "male",
    };
    setUserProfile(next);
    safeSetStorage(USER_PROFILE_KEY, JSON.stringify(next));
    setToast("Profile saved");
  }

  function openDiscoveryInApp(queryText, title = "Discovery Results") {
    const clean = queryText?.trim();
    if (!clean) {
      setToast("Enter a search query");
      return;
    }

    setDiscoverySheet({
      title,
      query: clean,
      results: getDiscoveryRestaurants(clean),
    });
  }

  function searchDiscoveryQuery() {
    openDiscoveryInApp(discoverQuery, discoverQuery.trim() || "Discovery Results");
  }

  function getDiscoveryRestaurantKey(item) {
    return `${String(item?.name || "").trim().toLowerCase()}|${String(item?.area || "").trim().toLowerCase()}`;
  }

  function isDiscoveryRestaurantSaved(item) {
    const key = getDiscoveryRestaurantKey(item);
    if (key === "|") return false;

    return restaurants.some((restaurant) => getDiscoveryRestaurantKey(restaurant) === key);
  }

  function saveDiscoveryRestaurant(item) {
    const name = String(item.name || "").trim();
    if (!name) {
      setToast("Restaurant name required");
      return;
    }

    if (isDiscoveryRestaurantSaved(item)) {
      setToast("Restaurant already saved");
      return;
    }

    const savedItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      area: String(item.area || "Not set").trim() || "Not set",
      notes: "",
      rating: String(item.rating || "").trim(),
      source: "Discovery",
      visitDate: "",
      visitTime: "",
      status: STATUS.PENDING,
      favorite: false,
      thumbnailUrl: "",
      thumbnailKey: "",
      searchUrl: createRestaurantSearchUrl(name, item.area),
      createdAt: new Date().toISOString(),
    };

    setRestaurants((items) => [savedItem, ...items]);
    setToast("Restaurant saved");

    setDiscoverySheet((sheet) => sheet ? {
      ...sheet,
      results: sheet.results.map((result) =>
        result.name === item.name && result.area === item.area ? { ...result, saved: true } : result
      ),
    } : sheet);
  }

  function addDiscoveryCategory() {
    const label = newDiscovery.label.trim();
    const rawQuery = newDiscovery.query.trim();
    if (!label) {
      setToast("Enter discovery name");
      return;
    }

    const duplicate = discoveryCategories.some((item) => item.label.trim().toLowerCase() === label.toLowerCase());
    if (duplicate) {
      setToast("Discovery already exists");
      return;
    }

    const queryText = rawQuery || `${label} restaurants near me`;
    const item = {
      label,
      icon: "🔎",
      query: queryText,
      custom: true,
    };

    setDiscoveryCategories((items) => [item, ...items]);
    setAddedDiscoveryLabel(label);
    window.setTimeout(() => setAddedDiscoveryLabel(""), 360);
    setNewDiscovery({ label: "", query: "" });
    setToast("Discovery added");
  }

  function removeDiscoveryCategory(label) {
    setRemovingDiscoveryLabels((labels) => [...new Set([...labels, label])]);
    window.setTimeout(() => {
      setDiscoveryCategories((items) => {
        const next = items.filter((item) => item.label !== label);
        return next.length ? next : DEFAULT_DISCOVER_CATEGORIES;
      });
      setRemovingDiscoveryLabels((labels) => labels.filter((item) => item !== label));
      setToast("Discovery removed");
    }, 260);
  }

  async function signInToCloud() {
    setIsCloudBusy(true);
    setCloudStatus("Opening Google sign-in...");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.warn("Popup sign-in failed, trying redirect", error);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
      } catch (redirectError) {
        console.error("Google sign-in failed", redirectError);
        setCloudStatus("Google sign-in failed. Try again.");
        setIsCloudBusy(false);
      }
    }
  }

  async function signOutFromCloud() {
    setIsCloudBusy(true);
    try {
      await signOut(auth);
      setCloudReady(false);
      setCloudStatus("Signed out. Local data remains on this device.");
    } catch (error) {
      console.error("Sign out failed", error);
      setCloudStatus("Sign out failed. Try again.");
    } finally {
      setIsCloudBusy(false);
    }
  }

  async function shareApp() {
    await smartShare({
      title: "Restaurant Finder and Planner APK",
      text:
        "Download Restaurant Finder and Planner APK. Discover, save, plan and share restaurants.",
      url: APK_PROMO_LINK,
    });
  }

  async function shareRestaurant(item) {
    await smartShare({
      title: item.name,
      text: createRestaurantShareText(item),
      url: item.searchUrl || createRestaurantSearchUrl(item.name, item.area),
    });
  }

  async function shareDiscoveryRestaurant(item) {
    const name = String(item?.name || "Restaurant").trim();
    const area = String(item?.area || "").trim();
    const details = [
      name,
      area,
      item?.rating ? `⭐ ${item.rating}` : "",
      item?.cuisine ? `Cuisine: ${item.cuisine}` : "",
      "Shared from Restaurant Finder and Planner by K7Artwork.AI.",
    ].filter(Boolean).join("\n");

    await smartShare({
      title: name,
      text: details,
      url: createRestaurantSearchUrl(name, area),
    });
  }

  const rowProps = {
    onUpdateVisit: updateVisit,
    onRemove: removeRestaurant,
    onToggleFavorite: toggleFavorite,
    onMarkVisited: toggleVisited,
    onMarkPlanned: markPlanned,
    onShare: shareRestaurant,
  };

  if (!userProfile.name) {
    return (
      <main className="onboarding-screen">
        <section className="onboarding-card">
          <img className="onboarding-logo image-logo" src={appLogo} alt="Restaurant Finder and Planner" />
          <p className="about-link">K7ARTWORK.AI</p>
          <h1>Welcome to Restaurant Finder and Planner</h1>
          <p>Personalize your restaurant planner.</p>

          <label>
            Your name
            <input
              value={profileDraft.name}
              onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
              placeholder="Enter your name"
            />
          </label>

          <div className="avatar-picker">
            <button
              className={profileDraft.avatar === "male" ? "selected" : ""}
              onClick={() => setProfileDraft({ ...profileDraft, avatar: "male" })}
              type="button"
            >
              <span>👨</span>
              Male
            </button>
            <button
              className={profileDraft.avatar === "female" ? "selected" : ""}
              onClick={() => setProfileDraft({ ...profileDraft, avatar: "female" })}
              type="button"
            >
              <span>👩</span>
              Female
            </button>
            <button
              className={profileDraft.avatar === "neutral" ? "selected" : ""}
              onClick={() => setProfileDraft({ ...profileDraft, avatar: "neutral" })}
              type="button"
            >
              <span>🧑</span>
              Other
            </button>
          </div>

          <button className="continue-btn" onClick={saveProfile}>Continue</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app tabbed-app">
      {toast && <div className="toast">{toast}</div>}
      <PremiumSplash visible={showSplash} />

      {mainTab === "home" && (
        <section className="screen active-screen">
          <header className="top-header">
            <AppLogo profile={userProfile} />
            <ThemeIconToggle resolvedTheme={resolvedTheme} onToggle={toggleThemeFromHome} />
          </header>

          <section className="discover-card animate-in ">
            <div>
              <h2>Discover Restaurants</h2>
              <p>Explore nearby places, cafes, family dining, and cuisine ideas.</p>
            </div>
            <button onClick={() => setMainTab("discover")}>Open Discover</button>
          </section>

          <section className="dashboard-card animate-in delay-1">
            <div className="card-title-row">
              <h2>Dashboard</h2>
              <button className="link-button" onClick={clearAll}>Clear</button>
            </div>

            <div className="stat-grid four">
              <button className="stat-card blue" onClick={() => openList("all")}><b>{totalCount}</b><span>Total Saved</span></button>
              <button className="stat-card green" onClick={() => openList(STATUS.PLANNED)}><b>{plannedCount}</b><span>Planned</span></button>
              <button className="stat-card orange" onClick={() => openList(STATUS.PENDING)}><b>{pendingCount}</b><span>Pending</span></button>
              <button className="stat-card teal" onClick={() => openList(STATUS.VISITED)}><b>{visitedCount}</b><span>Visited</span></button>
            </div>
          </section>

          <section className="list-section animate-in delay-2">
            <div className="section-title">
              <h2>Recently Added</h2>
              <button className="link-button" onClick={() => openList("all")}>View all</button>
            </div>

            <div className="restaurant-list">
              {recentRestaurants.map((item) => (
                <RestaurantRow key={item.id} item={item} thumbnailUrl={thumbnailUrls[item.id]} {...rowProps} />
              ))}
              {recentRestaurants.length === 0 && <div className="empty">No restaurants saved yet.</div>}
            </div>
          </section>
        </section>
      )}

      {mainTab === "add" && (
        <section className="screen active-screen">
          <div className="screen-title">
            <h2>Add Restaurant</h2>
            <span>Scan from screenshot or add manually</span>
          </div>

          <section className="add-card animate-in">
            <div className="section-title">
              <div>
                <h2>Add from Screenshot</h2>
                <p>Upload from gallery and detect restaurant information.</p>
              </div>
              <span className="confidence-pill">{detectedRestaurant ? `Confidence ${detectedRestaurant.confidence}%` : "OCR"}</span>
            </div>

            <div className="scan-grid">
              <label className="choose-image">
                <span>▣</span>
                <b>Choose Image</b>
                <input type="file" accept="image/*" onChange={pickGalleryImage} />
              </label>
              <div className="preview-box full-screenshot-preview">
                {galleryImage ? (
                  <>
                    <img src={galleryImage} alt="Selected screenshot" />
                    {isScanning && <div className="scan-overlay"><span>Scanning...</span></div>}
                  </>
                ) : (
                  <span>Image preview</span>
                )}
              </div>
            </div>

            <button className="primary-wide" disabled={!galleryImage} onClick={readRestaurantFromImage}>
              Detect Restaurant
            </button>

            {ocrStatus && (
              <div className="ocr-status">
                <span>{ocrStatus}</span>
                {ocrProgress > 0 && ocrProgress < 100 && <b>{ocrProgress}%</b>}
              </div>
            )}

            {ocrText && !detectedRestaurant && (
              <details className="ocr-raw-text">
                <summary>View detected text</summary>
                <pre>{ocrText}</pre>
              </details>
            )}
          </section>

          {detectedRestaurant && (
            <section className="form-card animate-in">
              <div className="section-title">
                <h2>Detected Information</h2>
              </div>
              <label>
                Restaurant Name
                <input value={detectedRestaurant.name} onChange={(e) => setDetectedRestaurant({ ...detectedRestaurant, name: e.target.value })} />
              </label>
              <label>
                Area / Location
                <input value={detectedRestaurant.area} onChange={(e) => setDetectedRestaurant({ ...detectedRestaurant, area: e.target.value })} />
              </label>
              <label>
                Rating
                <input value={detectedRestaurant.rating || ""} onChange={(e) => setDetectedRestaurant({ ...detectedRestaurant, rating: e.target.value })} placeholder="⭐ Rating, e.g. 4.6" />
              </label>
              <label>
                Notes
                <textarea value={detectedRestaurant.notes} onChange={(e) => setDetectedRestaurant({ ...detectedRestaurant, notes: e.target.value })} />
              </label>
              <button className="primary-wide" onClick={saveDetectedRestaurant}>Save Restaurant</button>
            </section>
          )}

          <section className="form-card animate-in delay-1">
            <div className="divider-title"><span>OR ADD MANUALLY</span></div>
            <label>
              Restaurant Name
              <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Restaurant name" />
            </label>
            <label>
              Area
              <input value={manual.area} onChange={(e) => setManual({ ...manual, area: e.target.value })} placeholder="Area" />
            </label>
            <label>
              Notes
              <input value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} placeholder="Notes" />
            </label>
            <label>
              Thumbnail URL optional
              <input value={manual.thumbnailUrl} onChange={(e) => setManual({ ...manual, thumbnailUrl: e.target.value })} placeholder="Image URL" />
            </label>
            <button className="primary-wide" onClick={addManual}>Add Manually</button>
          </section>
        </section>
      )}

      {mainTab === "saved" && (
        <section className="screen active-screen">
          <div className="screen-title with-actions">
            <div>
              <h2>Restaurants</h2>
              <span>{filtered.length} shown · {totalCount} saved</span>
            </div>
            <button className="icon-button" type="button" onClick={() => setQuery("")}>⌕</button>
          </div>

          <div className="tab-row five-tabs">
            <button className={listFilter === "all" ? "active" : ""} onClick={() => setListFilter("all")}>All</button>
            <button className={listFilter === STATUS.PLANNED ? "active" : ""} onClick={() => setListFilter(STATUS.PLANNED)}>Planned</button>
            <button className={listFilter === STATUS.PENDING ? "active" : ""} onClick={() => setListFilter(STATUS.PENDING)}>Pending</button>
            <button className={listFilter === STATUS.VISITED ? "active" : ""} onClick={() => setListFilter(STATUS.VISITED)}>Visited</button>
            <button className={listFilter === "favorites" ? "active" : ""} onClick={() => setListFilter("favorites")}>Fav</button>
          </div>

          <div className="search-pill compact">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search restaurants..." />
          </div>

          <div className="sort-row">
            <span>Sort</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="plannedDate">Planned date</option>
              <option value="favorites">Favorites first</option>
              <option value="visitedLast">Visited last</option>
            </select>
          </div>

          <div className="restaurant-list full">
            {filtered.map((item) => (
              <RestaurantRow key={item.id} item={item} thumbnailUrl={thumbnailUrls[item.id]} {...rowProps} />
            ))}
            {filtered.length === 0 && <div className="empty">No restaurants found.</div>}
          </div>
        </section>
      )}

      {mainTab === "discover" && (
        <section className="screen active-screen">
          <div className="screen-title">
            <h2>Discover</h2>
            <span>Restaurant discovery ideas in one place.</span>
          </div>

          <section className="discover-hero animate-in">
            <div className="discover-icon">🍽️</div>
            <h2>What should we eat next?</h2>
            <p>Use quick discovery shortcuts. Results open inside the app.</p>
            <button type="button" onClick={() => openDiscoveryInApp("restaurants near me", "Restaurants near me")}>Search restaurants near me</button>
          </section>

          <section className="settings-card animate-in delay-1">
            <h2>Quick Discovery</h2>
            <div className="discover-search-panel">
              <div className="search-pill compact discovery-search">
                <span>⌕</span>
                <input
                  value={discoverQuery}
                  onChange={(e) => setDiscoverQuery(e.target.value)}
                  placeholder="Search any restaurant or cuisine..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchDiscoveryQuery();
                  }}
                />
              </div>
              <button className="search-map-button" onClick={searchDiscoveryQuery}>Search Maps</button>
            </div>

            <div className="discover-grid editable-discovery-grid">
              {discoveryCategories.map((item) => (
                <div
                  className={`discover-item${addedDiscoveryLabel === item.label ? " discover-item-added" : ""}${removingDiscoveryLabels.includes(item.label) ? " discover-item-removing" : ""}`}
                  key={item.label}
                >
                  <button type="button" className="discover-item-open" onClick={() => openDiscoveryInApp(item.query, item.label)}>
                    <span>{item.icon}</span>
                    <b>{item.label}</b>
                  </button>
                  <button className="remove-discovery" onClick={() => removeDiscoveryCategory(item.label)} aria-label={`Remove ${item.label}`}>×</button>
                </div>
              ))}
            </div>

            <div className="add-discovery-box">
              <input
                value={newDiscovery.label}
                onChange={(e) => setNewDiscovery({ ...newDiscovery, label: e.target.value })}
                placeholder="Add discovery name, e.g. Sushi"
              />
              <input
                value={newDiscovery.query}
                onChange={(e) => setNewDiscovery({ ...newDiscovery, query: e.target.value })}
                placeholder="Optional search query"
              />
              <button onClick={addDiscoveryCategory}>Add Discovery</button>
            </div>
          </section>

          <section className="settings-card animate-in delay-2">
            <h2>Suggested Plans</h2>
            <div className="suggestion-list">
              {DISCOVER_SUGGESTIONS.map((item) => (
                <button key={item.title} type="button" onClick={() => openDiscoveryInApp(item.query, item.title)}>
                  <b>{item.title}</b>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      )}

      {mainTab === "profile" && (
        <section className="screen active-screen">
          <div className="screen-title">
            <div>
              <h2>Profile & Settings</h2>
              <span>App information and sharing</span>
            </div>
          </div>

          <section className="about-card animate-in">
            <img className="about-logo image-logo" src={appLogo} alt="Restaurant Finder and Planner" />

            <div className="about-content">
              <a href="https://k7artwork.free.nf/#about" target="_blank" rel="noopener noreferrer" className="about-link">
                K7ARTWORK.AI 🌐
              </a>
              <h2>Restaurant Finder and Planner</h2>
              <p>A private app for finding restaurants, saving ideas, scanning screenshots, and planning visits.</p>
            </div>
          </section>

          <section className="settings-card animate-in delay-1">
            <h2>About</h2>
            <div className="settings-row"><span>Developer</span><b>K7Artwork.AI</b></div>
            <div className="settings-row"><span>App</span><b>Restaurant Finder and Planner</b></div>
            <div className="settings-row"><span>Storage</span><b>Offline first</b></div>
            <div className="settings-row"><span>Total saved</span><b>{totalCount}</b></div>
            <div className="settings-row"><span>Favorites</span><b>{favoriteCount}</b></div>
            <div className="settings-row"><span>Version</span><b>{APP_VERSION}</b></div>
            <div className="settings-row"><span>Build</span><b>Protected K7Artwork build</b></div>
          </section>

          <section className="settings-card animate-in delay-2">
            <h2>Cloud Backup</h2>
            <div className="cloud-sync-panel">
              <div>
                <b>{firebaseUser ? (firebaseUser.displayName || firebaseUser.email || "Google account") : "Sign in to protect your saved restaurants"}</b>
                <p>{cloudStatus}</p>
              </div>
              {firebaseUser ? (
                <button type="button" onClick={signOutFromCloud} disabled={isCloudBusy}>
                  {isCloudBusy ? "Please wait..." : "Sign out"}
                </button>
              ) : (
                <button type="button" onClick={signInToCloud} disabled={isCloudBusy}>
                  {isCloudBusy ? "Opening..." : "Sign in with Google"}
                </button>
              )}
            </div>
            <p className="cloud-sync-note">Saved restaurants stay on this phone and are backed up to your Firebase account after sign-in.</p>
          </section>

          <section className="settings-card animate-in delay-3">
            <h2>Smart Sharing</h2>
            <div className="share-panel">
              <p>Share the Android APK download link with friends.</p>
              <button onClick={shareApp}>Share APK with Friends</button>
            </div>
          </section>
        </section>
      )}

      {discoverySheet && (
        <section className="map-overlay" role="dialog" aria-modal="true" aria-label={discoverySheet.title}>
          <div className="map-sheet discovery-results-sheet">
            <div className="map-sheet-header">
              <div>
                <span>In-app Discovery</span>
                <h2>{discoverySheet.title}</h2>
                <p>{discoverySheet.query}</p>
              </div>
              <button type="button" onClick={() => setDiscoverySheet(null)} aria-label="Close results">×</button>
            </div>

            <div className="discovery-results-list">
              {discoverySheet.results.length ? (
                discoverySheet.results.map((item) => (
                  <article className="discovery-result-card" key={`${item.name}-${item.area}`}>
                    <div className="discovery-result-header">
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.area}</p>
                      </div>
                      <div className="discovery-card-actions">
                        <button
                          type="button"
                          className={`save-discovery-btn ${isDiscoveryRestaurantSaved(item) ? "saved" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            saveDiscoveryRestaurant(item);
                          }}
                          aria-label={isDiscoveryRestaurantSaved(item) ? "Restaurant saved" : "Save restaurant"}
                          title={isDiscoveryRestaurantSaved(item) ? "Saved" : "Save restaurant"}
                        >
                          {isDiscoveryRestaurantSaved(item) ? "✓" : "♡"}
                        </button>
                        <button
                          type="button"
                          className="share-discovery-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            shareDiscoveryRestaurant(item);
                          }}
                          aria-label={`Share ${item.name}`}
                          title="Share restaurant"
                        >
                          📤
                        </button>
                      </div>
                    </div>
                    <div className="result-meta">
                      {item.rating && <span>⭐ {item.rating}</span>}
                      {item.distance && <span>📍 {item.distance}</span>}
                      {item.cuisine && <span>🍽 {item.cuisine}</span>}
                    </div>
                    <p className="result-trust">Shown because: {item.trust || "tag match"}</p>
                    <button type="button" className="open-result-map-btn" onClick={() => openSafeExternalUrl(createMapSearchUrl(`${item.name} ${item.area}`))}>Open Maps</button>
                  </article>
                ))
              ) : (
                <div className="discovery-empty-state">
                  <h3>No clean matches found</h3>
                  <p>Try another tag or open the same search in Google Maps.</p>
                </div>
              )}
            </div>

            <div className="map-sheet-actions">
              <button type="button" onClick={() => openSafeExternalUrl(createMapSearchUrl(discoverySheet.query))}>Open full search in Google Maps</button>
            </div>
          </div>
        </section>
      )}

      <button className="floating-add" onClick={() => setMainTab("add")}>+</button>

      <nav className="bottom-nav">
        <button className={mainTab === "home" ? "active" : ""} onClick={() => setMainTab("home")}>🏠<span>Home</span></button>
        <button className={mainTab === "add" ? "active" : ""} onClick={() => setMainTab("add")}>＋<span>Add</span></button>
        <button className={mainTab === "discover" ? "active discover-active" : ""} onClick={() => setMainTab("discover")}>✨<span>Discover</span></button>
        <button className={mainTab === "saved" ? "active" : ""} onClick={() => setMainTab("saved")}>♡<span>Saved</span></button>
        <button className={mainTab === "profile" ? "active" : ""} onClick={() => setMainTab("profile")}>👤<span>Profile</span></button>
      </nav>
    </main>
  );
}
