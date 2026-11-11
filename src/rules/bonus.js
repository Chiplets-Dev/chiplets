import { RuleError } from './common.js';

// Free chips for signed-in players, mobile-game style. Pure functions over small state objects, so the
// server and the tests share them. Money in cents, times in ms. Free chips only — never sold (D-12).

// Day 1…7 of a streak; day 7 then repeats for as long as the streak lasts.
export const DAILY = [100, 150, 200, 300, 400, 600, 1000].map((chips) => chips * 100);
export const DAILY_GAP = 20 * 3600e3; // the next daily bonus is ready 20 hours after the last
export const STREAK_GRACE = 48 * 3600e3; // more than 48 hours between claims starts the streak over
export const CHEST_EVERY = 4 * 3600e3;
export const CHEST_MIN = 25 * 100;
export const CHEST_MAX = 100 * 100;

// state = { streak, last } (days claimed in a row, time of the last claim) or null for never.
export function dailyStatus(state, now) {
  const last = state?.last;
  if (last === undefined || last === null) return { claimable: true, day: 1, streak: 0, nextAt: now, expiresAt: null, amount: DAILY[0], broken: false };
  const since = now - last;
  const broken = since >= STREAK_GRACE;
  const streak = broken ? 0 : state.streak || 0;
  const day = Math.min(streak + 1, DAILY.length);
  return {
    claimable: since >= DAILY_GAP,
    day, // the day the next claim counts as
    streak, // days claimed in a row so far
    nextAt: last + DAILY_GAP,
    expiresAt: broken ? null : last + STREAK_GRACE, // claim before this to keep the streak
    amount: DAILY[day - 1],
    broken,
  };
}

export function claimDaily(state, now) {
  const st = dailyStatus(state, now);
  if (!st.claimable) throw new RuleError('bonus', 'Your next daily bonus isn’t ready yet.');
  return { state: { streak: st.day, last: now }, amount: st.amount, day: st.day };
}

// state = { next } (when the chest is full again) or null.
export const chestStatus = (state, now) => ({ claimable: now >= (state?.next || 0), nextAt: state?.next || now });

export function openChest(state, now, randInt) {
  if (now < (state?.next || 0)) throw new RuleError('bonus', 'The chest is still refilling.');
  const amount = CHEST_MIN + randInt((CHEST_MAX - CHEST_MIN) / 100 + 1) * 100; // whole chips, 25–100
  return { state: { next: now + CHEST_EVERY }, amount };
}
