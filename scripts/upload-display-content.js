// Runs inside GitHub Actions (see .github/workflows/upload-display-content.yml).
// Mirrors display.js's addDisplayContent() exactly — same item shape
// ({id, type, url, storagePath}), same Storage path prefix
// ("home-display/"), same Firestore doc ("public/homeDisplay") — so
// content added this way is indistinguishable from content added through
// the app's own founder upload flow. Uses the Admin SDK, which bypasses
// Storage/Firestore security rules entirely (that's what a service
// account is for), so there's no founder-auth check here the way
// display.js's browser-side version has — the workflow trigger itself is
// the access boundary.

const fs = require("fs");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const contentType = process.env.CONTENT_TYPE;
const fileName = process.env.FILE_NAME;

// Firebase changed its default bucket naming convention (older projects:
// <project-id>.appspot.com, newer: <project-id>.firebasestorage.app) —
// the app's client-side config says .firebasestorage.app, but that's not
// proof a bucket was actually ever provisioned under that name (the
// Storage "Get started" step has to be completed at least once). Trying
// both here and reporting which one (if either) is real, rather than
// assuming the client config is authoritative.
const CANDIDATE_BUCKETS = [
  "kosmic-kat-studio.firebasestorage.app",
  "kosmic-kat-studio.appspot.com",
];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function findRealBucket() {
  for (const name of CANDIDATE_BUCKETS) {
    try {
      const bucket = admin.storage().bucket(name);
      const [exists] = await bucket.exists();
      console.log(`Bucket ${name}: exists=${exists}`);
      if (exists) return bucket;
    } catch (err) {
      console.log(`Bucket ${name}: error checking - ${err.message}`);
    }
  }
  return null;
}

async function main() {
  const bucket = await findRealBucket();
  if (!bucket) {
    throw new Error(
      "No Storage bucket exists under either kosmic-kat-studio.firebasestorage.app or kosmic-kat-studio.appspot.com. " +
      "This means Firebase Storage was likely never fully set up for this project (the 'Get started' step in the Storage console has to be completed once) — not a code or credentials problem."
    );
  }
  const db = admin.firestore();

  const storagePath = `home-display/${Date.now()}_${fileName}`;
  console.log(`Uploading to Storage: ${storagePath}`);

  await bucket.upload("/tmp/upload_file", {
    destination: storagePath,
    metadata: {
      contentType: contentType === "video" ? "video/mp4" : "image/jpeg",
    },
  });

  // Admin SDK files aren't public by default — display.js's item.url needs
  // to be directly playable/viewable by any visitor, same as the browser
  // upload path already produces via getDownloadURL(). makePublic() + the
  // stable public URL format matches that.
  const file = bucket.file(storagePath);
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  const item = {
    id: "disp_" + Date.now(),
    type: contentType,
    url: publicUrl,
    storagePath,
  };

  console.log("Writing Firestore entry:", item);
  const docRef = db.collection("public").doc("homeDisplay");
  const doc = await docRef.get();
  const existingItems = doc.exists && Array.isArray(doc.data().items) ? doc.data().items : [];
  existingItems.push(item);
  await docRef.set({ items: existingItems, updatedAt: Date.now() });

  console.log("Done. Public URL:", publicUrl);
  return item;
}

main()
  .then((item) => {
    fs.writeFileSync("/tmp/result.json", JSON.stringify({ success: true, item }, null, 2));
  })
  .catch((err) => {
    console.error("Upload failed:", err);
    fs.writeFileSync("/tmp/result.json", JSON.stringify({ success: false, error: String(err && err.message || err), stack: String(err && err.stack || "") }, null, 2));
    process.exitCode = 1;
  });
