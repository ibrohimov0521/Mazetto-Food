import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("desktop login preserves authenticated session until device enrollment", () => {
  const mainSource = readFileSync("src/main.ts", "utf8");
  const loginStart = mainSource.indexOf('"desktop:auth:login"');
  const loginEnd = mainSource.indexOf("function setupApiControls", loginStart);
  assert.notEqual(loginStart, -1);
  assert.notEqual(loginEnd, -1);
  const loginHandler = mainSource.slice(loginStart, loginEnd);

  assert.match(loginHandler, /printWorker\?\.setAuthorization\(/);
  assert.doesNotMatch(loginHandler, /if\s*\(!heartbeat\.ok\)/);

  const authProvider = readFileSync(
    "../pos-web/components/auth/auth-provider.tsx",
    "utf8",
  );
  const desktopLoginStart = authProvider.indexOf("if (desktopLogin)");
  const browserLoginStart = authProvider.indexOf(
    "const response = await fetch",
    desktopLoginStart,
  );
  assert.notEqual(desktopLoginStart, -1);
  assert.notEqual(browserLoginStart, -1);
  const desktopLoginBranch = authProvider.slice(
    desktopLoginStart,
    browserLoginStart,
  );
  assert.match(desktopLoginBranch, /writeSession\(session\)/);
  assert.match(desktopLoginBranch, /router\.replace\(await getLoginRedirect\(session\)\)/);

  const redirectStart = authProvider.indexOf(
    "async function getLoginRedirect",
  );
  const redirectEnd = authProvider.indexOf("export function useAuth", redirectStart);
  assert.notEqual(redirectStart, -1);
  assert.notEqual(redirectEnd, -1);
  const loginRedirect = authProvider.slice(redirectStart, redirectEnd);
  assert.match(loginRedirect, /desktopPayload\?\.data\?\.mode === "online"/);
  assert.match(loginRedirect, /heartbeat\.status === 404/);
  assert.doesNotMatch(loginRedirect, /if\s*\(!heartbeat\.ok\)/);
  assert.doesNotMatch(
    loginRedirect,
    /catch\s*\{\s*return "\/device-enrollment"/,
  );

  const enrollment = readFileSync(
    "../pos-web/components/auth/desktop-enrollment.tsx",
    "utf8",
  );
  assert.match(enrollment, /error instanceof ApiRequestError && error\.status === 404/);
  assert.match(enrollment, /openOnUnenrolled && isEnrolled === false/);
  assert.match(enrollment, /Qurilma ulanish holatini aniqlab bo'lmadi/);
  const enrollmentAction = enrollment.slice(
    enrollment.indexOf("async function enroll()"),
  );
  assert.doesNotMatch(enrollmentAction, /apiFetch\("\/devices\/heartbeat"/);

  const loginPage = readFileSync("../pos-web/app/login/page.tsx", "utf8");
  assert.match(loginPage, /initialSessionHandled = useRef\(false\)/);
  assert.match(loginPage, /router\.replace\(getPrimaryRedirect\(session\.user\)\)/);
  assert.match(loginPage, /if \(!isReady \|\| initialSessionHandled\.current\) return/);
});
