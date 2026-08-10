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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "kosmic-kat-studio.firebasestorage.app",
});

async function main() {
  const bucket = admin.storage().bucket();
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
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
