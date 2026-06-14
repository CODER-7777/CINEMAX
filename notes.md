# Interview Preparation Notes: CINEMAX (ACA253)

These are my personal study notes covering the core software engineering principles, architectural patterns, and deep-dive technical concepts utilized in the CINEMAX ticketing platform. These topics are highly likely to come up during technical interviews.

---

## 1. Stateless Authentication & JSON Web Tokens (JWT)

**How it was used in CINEMAX:**
When a user signs in, the server generates a JWT containing their `userId` and signs it using a `JWT_SECRET`. The server does NOT store user sessions in memory. The client stores this token in `localStorage` and attaches it to the `Authorization: Bearer <token>` header for every protected request (e.g., booking a ticket, leaving a review).

**Deep Dive:**
- **Structure:** A JWT has 3 parts separated by dots: `Header.Payload.Signature`.
  - **Header:** Defines the algorithm (e.g., HS256).
  - **Payload:** The data (e.g., user ID, expiration time). Base64 encoded, meaning *anyone can read it* (never put passwords here).
  - **Signature:** Created by hashing the Header + Payload using the secret key on the server. If a hacker alters the payload, the signature will become invalid, and the server will reject it.
- **Why Stateless?** Unlike traditional Session IDs where the server must query a database/memory to check if a user is logged in, a JWT is self-contained. The server just verifies the cryptographic signature mathematically. This makes scaling to multiple servers vastly easier.

**Resources to Study:**
- [JWT.io Introduction](https://jwt.io/introduction)
- [Auth0: Token-Based Authentication](https://auth0.com/learn/token-based-authentication/)

---

## 2. Password Cryptography (Bcrypt & Salting)

**How it was used in CINEMAX:**
When a user signs up, their plain text password is mathematically hashed using `bcrypt` before being saved to MongoDB. 

**Deep Dive:**
- **Hashing vs Encryption:** Encryption is a two-way street (you can decrypt data if you have the key). Hashing is a **one-way** street. You cannot reverse a hash back to the original password.
- **What is a Salt?** A salt is random data appended to a password before hashing. If two users have the password `password123`, a simple hash would look identical for both. A hacker could use a "Rainbow Table" (a pre-computed list of common password hashes) to crack them instantly. By adding a unique "Salt" to every password, the resulting hashes are completely different, rendering rainbow tables useless.
- **Bcrypt Work Factor (Rounds):** Bcrypt is designed to be intentionally *slow*. By increasing the "salt rounds" (e.g., 10 rounds), we force the CPU to work harder. If a hacker steals our database, it would take them centuries to brute-force the hashes because computing each hash takes too much computing power.

**Resources to Study:**
- [Computerphile: How NOT to Store Passwords (YouTube)](https://www.youtube.com/watch?v=8ZtInClZeP0)
- [Auth0: Adding Salt to Hashing](https://auth0.com/blog/adding-salt-to-hashing-a-better-way-to-store-passwords/)

---

## 3. HMAC-SHA256 Cryptographic Signatures (Razorpay Integration)

**How it was used in CINEMAX:**
When a payment succeeds, Razorpay sends the client a `razorpay_payment_id` and a `razorpay_signature`. The client sends these to our `/api/bookings/verify` backend endpoint.

**Deep Dive:**
- **The Problem:** What if a malicious user bypasses Razorpay entirely and sends a fake API request to our backend saying "I paid for 10 tickets"?
- **The Solution (HMAC):** Razorpay generates a signature by combining the `order_id` and `payment_id` and hashing it using our secret `RAZORPAY_KEY_SECRET` (which ONLY Razorpay and our Backend know).
- **Verification:** Our backend takes the `order_id` and `payment_id` it received from the client, and hashes them using our own `RAZORPAY_KEY_SECRET` using the `crypto.createHmac('sha256')` algorithm. If our generated hash perfectly matches the `razorpay_signature` provided by the client, we know with 100% mathematical certainty that the payment is legitimate and originated from Razorpay.

**Resources to Study:**
- [Razorpay Docs: Payment Signature Verification](https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#step-4-verify-the-signature)
- [What is HMAC? (Wikipedia)](https://en.wikipedia.org/wiki/HMAC)

---

## 4. Node.js Streams & Memory Buffers (PDF Generation)

**How it was used in CINEMAX:**
Instead of generating a physical `.pdf` file on the server's hard drive (which is slow and fills up storage), `pdfkit` was used to generate the ticket purely in the server's RAM (Memory) using Buffers, which was then emailed and streamed to the user.

**Deep Dive:**
- **Streams:** Node.js Streams allow you to process data piece by piece (chunks) instead of loading a massive file into memory all at once. Think of it like watching a YouTube video (streaming) vs downloading a 5GB movie before watching it.
- **Buffers:** A Buffer is a temporary storage spot for a chunk of raw binary data. In CINEMAX, as `pdfkit` drew the ticket, we listened for the `data` event and pushed those raw binary chunks into an array. When it finished (the `end` event), we concatenated them into one single Buffer using `Buffer.concat()`. We then passed this Buffer directly to `nodemailer` as an attachment, bypassing the hard drive entirely!

**Resources to Study:**
- [Node.js Official Guide: Streams](https://nodejs.org/en/docs/guides/anatomy-of-an-http-transaction/#streams)
- [FreeCodeCamp: Node.js Streams and Buffers Explained](https://www.freecodecamp.org/news/do-you-want-a-better-understanding-of-buffer-in-node-js-check-this-out-2e29de2968e8/)

---

## 5. MongoDB & Mongoose: Referencing vs Embedding

**How it was used in CINEMAX:**
We used a highly normalized database design. For example, a `Review` document doesn't store the user's email directly. It stores a `userId` (an ObjectId). We then used Mongoose's `.populate('userId')` to fetch the email dynamically. Conversely, the `Showtime` document *embeds* the `seats` directly as an array of objects inside the document.

**Deep Dive:**
- **Embedding (Denormalization):** Storing related data in a single document. We embedded `seats` inside `Showtime` because seats are entirely dependent on that specific showtime. You will never query a "Seat" without querying its Showtime first. This allows for hyper-fast reads.
- **Referencing (Normalization):** Storing the ID of another document. We referenced `userId` inside `Review` because User data changes (e.g., user updates their email). If we embedded the email in the review, we would have to update thousands of reviews if the user changed their email. Referencing ensures a "Single Source of Truth."

**Resources to Study:**
- [MongoDB Schema Design Best Practices](https://www.mongodb.com/developer/products/mongodb/mongodb-schema-design-best-practices/)
- [Mongoose Documentation: Populate](https://mongoosejs.com/docs/populate.html)

---

## 6. REST API Design Principles

**How it was used in CINEMAX:**
We structured URLs around "Resources" (Nouns) rather than "Actions" (Verbs).
- `GET /api/movies` (Fetch all)
- `POST /api/reviews` (Create new)
- We heavily relied on proper HTTP Status Codes.

**Deep Dive into Status Codes:**
- `200 OK`: Standard success.
- `201 Created`: Successfully created a new resource (e.g., Sign up, Add Review).
- `400 Bad Request`: Client error (e.g., trying to review a movie twice).
- `401 Unauthorized`: Client lacks valid authentication credentials (e.g., missing JWT).
- `403 Forbidden`: Client is authenticated but lacks permission (not used heavily here, but good to know).
- `404 Not Found`: The resource doesn't exist.
- `500 Internal Server Error`: Our backend crashed or the database failed.

**Resources to Study:**
- [IBM: What is a REST API?](https://www.ibm.com/topics/rest-apis)
- [MDN Web Docs: HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
