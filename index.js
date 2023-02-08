// @ts-check
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { randomUUID } from "crypto";
import { createTransport } from "nodemailer";
import { epub } from "percollate";
import Parser from "rss-parser";
import slugify from "slugify";

import * as Sentry from '@sentry/node';

const ensureEnv = (name, value) => {
  if (!value) {
    throw new Error(`Environment variable ${name} must be set`);
  }

  return value;
};

const getLastFetchTime = async () => {
  try {
    const raw_time = await fs.promises.readFile("./last_fetch.dat", "utf-8");
    return new Date(raw_time);
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Date(0);
    }

    throw error;
  }
};

const saveLastFetchTime = async (date) => {
  await fs.promises.writeFile("./last_fetch.dat", date.toUTCString());
};

const processFeed = async (feedUrl, sendTo, smtpAuth, tempDir) => {
  let lastFetchTime = await getLastFetchTime();
  let epubFiles = [];

  const response = await fetch(feedUrl);
  const feed = await new Parser().parseString(await response.text());

  const newItems = feed.items
    .filter((i) => new Date(i.isoDate) > lastFetchTime)
    .filter((i) => !!i.link)
    .sort(
      (a, b) => new Date(a.isoDate).valueOf() - new Date(b.isoDate).valueOf()
    );

  console.log(`Found ${newItems.length} new items`);
  if (newItems.length === 0) {
    return;
  }

  // Take 3 first articles to fit into single email
  const epubs = newItems.slice(0, 3).map((i) => {
    const { pathname } = new URL(i.link);
    const filename = path.parse(pathname).name + ".epub";

    lastFetchTime = new Date(i.isoDate);
    epubFiles.push(filename);

    console.debug(`Generating ${filename} from ${i.link}`);

    return epub([i.link], {
      output: path.resolve(tempDir, filename),
      style: "./epub.css",
      cover: true,
      debug: true,
    });
  });

  const infos = await Promise.all(epubs);

  const smtp = createTransport({
    port: 587,
    host: "smtp.gmail.com",
    auth: smtpAuth,
  });

  const attachments = infos.map(({ items, options }) => ({
    path: options.output,
    filename: `${slugify(items[0].title)}.epub`,
    contentType: "application/epub+zip",
  }));

  const attachmentsFilenames = attachments.map((a) => a.filename).join(", ");
  console.log(`Sending email with attachments: ${attachmentsFilenames}`);

  await smtp.sendMail({
    from: smtpAuth.user,
    to: sendTo,
    subject: "New article from Pocket",
    text: "Hello from Out of Pocket!",
    attachments,
  });

  await saveLastFetchTime(lastFetchTime);
};


const feedUrl = ensureEnv("FEED_URL", process.env.FEED_URL);
const user = ensureEnv("SMTP_USER", process.env.SMTP_USER);
const pass = ensureEnv("SMTP_PASSWORD", process.env.SMTP_PASSWORD);
const sendTo = ensureEnv("SEND_TO", process.env.SEND_TO);
const processIntervalMin = Number(process.env.PROCESS_INTERVAL) || 15;

// Sentry reads SENTRY_DSN on its own
Sentry.init();

const main = async () => {
  const tempDir = path.resolve(os.tmpdir(), randomUUID());

  try {
    fs.mkdirSync(tempDir, { recursive: true });
    await processFeed(feedUrl, sendTo, { user, pass }, tempDir);
    console.log("✅ Done!");
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

await main();
setInterval(main, processIntervalMin * 60 * 1000);
