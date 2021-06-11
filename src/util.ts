// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import type { Stream, Readable } from "stream";

export const print = (message: string) => {
  console.log(message);
};

export function isObject(_: Object) {
  return !!_ && typeof _ === "object";
}

export const compose =
  <T extends Function>(...functions: T[]) =>
  (args) =>
    functions.reduceRight((arg, fn) => fn(arg), args);

export const toBuffer = async (stream: Readable) => {
  const chunks = [];
  for await (let chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const streamToString = async (stream: Stream) => {
  let chunks = "";

  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk: string) => (chunks += chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(chunks));
  });
};

export const parseCookies = (cookieHeader = "") => {
  const cookies = cookieHeader.split(/; */);
  const decode = decodeURIComponent;

  if (cookies[0] === "") return {};

  const result = {};
  for (let cookie of cookies) {
    const isKeyValue = cookie.includes("=");

    if (!isKeyValue) {
      result[cookie.trim()] = true;
      continue;
    }

    let [key, value] = cookie.split("=");

    key.trim();
    value.trim();

    if ('"' === value[0]) value = value.slice(1, -1);

    try {
      value = decode(value);
    } catch (error) {
      // neglect
    }

    result[key] = value;
  }

  return result;
};

export const parseAcceptHeader = ({ accept = "*/*" }) => {
  const preferredType = accept.split(",").shift();
  const format = preferredType?.split("/").pop();

  return format;
};
