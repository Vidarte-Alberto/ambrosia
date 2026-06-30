const DATABASE_NAME = "ambrosia-btc";
const DATABASE_VERSION = 1;
const CHECKOUT_STORE_NAME = "pending-checkouts";
const BACKGROUND_SYNC_TAG = "btc-checkout";

const STATUS_PENDING = "pending";
const STATUS_COMPLETED = "completed";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    openRequest.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(CHECKOUT_STORE_NAME)) {
        database.createObjectStore(CHECKOUT_STORE_NAME, { keyPath: "paymentHash" });
      }
    };

    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
}

function runCheckoutRequest(mode, buildRequest) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(CHECKOUT_STORE_NAME, mode);
    const checkoutStore = transaction.objectStore(CHECKOUT_STORE_NAME);
    const request = buildRequest(checkoutStore);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function getCheckoutsByStatus(status) {
  return runCheckoutRequest("readonly", (checkoutStore) => checkoutStore.getAll())
    .then((allCheckouts) => (allCheckouts || []).filter((checkout) => checkout.status === status));
}

export async function savePendingCheckout({ paymentHash, checkoutPayload }) {
  const pendingCheckout = {
    paymentHash,
    checkoutPayload,
    status: STATUS_PENDING,
    savedAt: Date.now(),
  };
  return runCheckoutRequest("readwrite", (checkoutStore) => checkoutStore.put(pendingCheckout));
}

export async function markCheckoutCompleted(paymentHash, completedResult) {
  const existingCheckout = await runCheckoutRequest(
    "readonly",
    (checkoutStore) => checkoutStore.get(paymentHash),
  );
  const completedCheckout = {
    ...existingCheckout,
    paymentHash,
    status: STATUS_COMPLETED,
    completedResult,
    completedAt: Date.now(),
  };
  return runCheckoutRequest("readwrite", (checkoutStore) => checkoutStore.put(completedCheckout));
}

export function getPendingCheckouts() {
  return getCheckoutsByStatus(STATUS_PENDING);
}

export function getCompletedCheckouts() {
  return getCheckoutsByStatus(STATUS_COMPLETED);
}

export async function deleteCheckout(paymentHash) {
  return runCheckoutRequest("readwrite", (checkoutStore) => checkoutStore.delete(paymentHash));
}

export async function registerBtcCheckoutSync() {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator) || !("SyncManager" in self)) return;
  try {
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;
    await serviceWorkerRegistration.sync.register(BACKGROUND_SYNC_TAG);
  } catch {
    return;
  }
}
