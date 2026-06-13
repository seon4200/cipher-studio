"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs");
function getVideoDimensions(filePath) {
  return new Promise((resolve, reject) => {
    const escapedPath = filePath.replace(/"/g, '\\"');
    child_process.exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${escapedPath}"`, (err, stdout) => {
      if (err) {
        console.error(`[ffmpeg] Error de ffprobe para dimensiones de ${filePath}:`, err);
        reject(err);
        return;
      }
      const parts = stdout.trim().split("x");
      const width = parseInt(parts[0], 10);
      const height = parseInt(parts[1], 10);
      if (isNaN(width) || isNaN(height)) {
        reject(new Error("Invalid dimensions parsed from ffprobe: " + stdout));
      } else {
        resolve({ width, height });
      }
    });
  });
}
function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const escapedPath = filePath.replace(/"/g, '\\"');
    child_process.exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${escapedPath}"`, (err, stdout) => {
      if (err) {
        console.error(`[ffmpeg] Error de ffprobe para ${filePath}:`, err);
        resolve(5);
        return;
      }
      const dur = parseFloat(stdout.trim());
      resolve(isNaN(dur) ? 5 : dur);
    });
  });
}
function generateVideoThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    const escapedThumb = thumbnailPath.replace(/"/g, '\\"');
    child_process.exec(`ffmpeg -y -ss 0.5 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err) => {
      if (err) {
        child_process.exec(`ffmpeg -y -ss 0.0 -i "${escapedVideo}" -vframes 1 -f image2 "${escapedThumb}"`, (err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}
function formatTimeMinutesSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d2 = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d2.get ? d2 : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var src = {};
var client = {};
var config = {};
var middleware = {};
(function(exports) {
  var __awaiter2 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TARGET_URL_HEADER = void 0;
  exports.withMiddleware = withMiddleware;
  exports.withProxy = withProxy;
  function withMiddleware(...middlewares) {
    const isDefined = (middleware2) => typeof middleware2 === "function";
    return (config2) => __awaiter2(this, void 0, void 0, function* () {
      let currentConfig = Object.assign({}, config2);
      for (const middleware2 of middlewares.filter(isDefined)) {
        currentConfig = yield middleware2(currentConfig);
      }
      return currentConfig;
    });
  }
  exports.TARGET_URL_HEADER = "x-fal-target-url";
  function shouldProxy(when) {
    const env = {
      isBrowser: typeof window !== "undefined" && typeof window.document !== "undefined"
    };
    if (typeof when === "function") {
      return when(env);
    }
    if (when === "always") {
      return true;
    }
    return env.isBrowser;
  }
  function withProxy(config2) {
    return (requestConfig) => {
      if (requestConfig.headers && exports.TARGET_URL_HEADER in requestConfig.headers) {
        return Promise.resolve(requestConfig);
      }
      if (!shouldProxy(config2.when)) {
        return Promise.resolve(requestConfig);
      }
      return Promise.resolve(Object.assign(Object.assign({}, requestConfig), { url: config2.targetUrl, headers: Object.assign(Object.assign({}, requestConfig.headers || {}), { [exports.TARGET_URL_HEADER]: requestConfig.url }) }));
    };
  }
})(middleware);
var response = {};
var headers = {};
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.RUNNER_HINT_HEADER = exports.QUEUE_PRIORITY_HEADER = exports.REQUEST_TIMEOUT_TYPE_HEADER = exports.REQUEST_TIMEOUT_HEADER = exports.MIN_REQUEST_TIMEOUT_SECONDS = void 0;
  exports.validateTimeoutHeader = validateTimeoutHeader;
  exports.buildTimeoutHeaders = buildTimeoutHeaders;
  exports.MIN_REQUEST_TIMEOUT_SECONDS = 1;
  exports.REQUEST_TIMEOUT_HEADER = "x-fal-request-timeout";
  exports.REQUEST_TIMEOUT_TYPE_HEADER = "x-fal-request-timeout-type";
  exports.QUEUE_PRIORITY_HEADER = "x-fal-queue-priority";
  exports.RUNNER_HINT_HEADER = "x-fal-runner-hint";
  function validateTimeoutHeader(timeout) {
    if (typeof timeout !== "number" || isNaN(timeout)) {
      throw new Error(`Timeout must be a number, got ${timeout}`);
    }
    if (timeout <= exports.MIN_REQUEST_TIMEOUT_SECONDS) {
      throw new Error(`Timeout must be greater than ${exports.MIN_REQUEST_TIMEOUT_SECONDS} seconds`);
    }
    return timeout.toString();
  }
  function buildTimeoutHeaders(timeout) {
    if (timeout === void 0) {
      return {};
    }
    return {
      [exports.REQUEST_TIMEOUT_HEADER]: validateTimeoutHeader(timeout)
    };
  }
})(headers);
var __awaiter$6 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(response, "__esModule", { value: true });
response.ValidationError = response.ApiError = void 0;
response.defaultResponseHandler = defaultResponseHandler;
response.resultResponseHandler = resultResponseHandler;
const headers_1$2 = headers;
const REQUEST_ID_HEADER = "x-fal-request-id";
class ApiError extends Error {
  constructor({ message, status, body, requestId, timeoutType }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.requestId = requestId || "";
    this.timeoutType = timeoutType;
  }
  /**
   * Returns true if this error was caused by a user-specified timeout
   * (via startTimeout parameter). These errors should NOT be retried.
   */
  get isUserTimeout() {
    return this.status === 504 && this.timeoutType === "user";
  }
}
response.ApiError = ApiError;
class ValidationError extends ApiError {
  constructor(args) {
    super(args);
    this.name = "ValidationError";
  }
  get fieldErrors() {
    if (typeof this.body.detail === "string") {
      return [
        {
          loc: ["body"],
          msg: this.body.detail,
          type: "value_error"
        }
      ];
    }
    return this.body.detail || [];
  }
  getFieldErrors(field) {
    return this.fieldErrors.filter((error) => error.loc[error.loc.length - 1] === field);
  }
}
response.ValidationError = ValidationError;
function defaultResponseHandler(response2) {
  return __awaiter$6(this, void 0, void 0, function* () {
    var _a;
    const { status, statusText } = response2;
    const contentType = (_a = response2.headers.get("Content-Type")) !== null && _a !== void 0 ? _a : "";
    const requestId = response2.headers.get(REQUEST_ID_HEADER) || void 0;
    const timeoutType = response2.headers.get(headers_1$2.REQUEST_TIMEOUT_TYPE_HEADER) || void 0;
    if (!response2.ok) {
      if (contentType.includes("application/json")) {
        const body = yield response2.json();
        const ErrorType = status === 422 ? ValidationError : ApiError;
        throw new ErrorType({
          message: body.message || statusText,
          status,
          body,
          requestId,
          timeoutType
        });
      }
      throw new ApiError({
        message: `HTTP ${status}: ${statusText}`,
        status,
        requestId,
        timeoutType
      });
    }
    if (contentType.includes("application/json")) {
      return response2.json();
    }
    if (contentType.includes("text/html")) {
      return response2.text();
    }
    if (contentType.includes("application/octet-stream")) {
      return response2.arrayBuffer();
    }
    return response2.text();
  });
}
function resultResponseHandler(response2) {
  return __awaiter$6(this, void 0, void 0, function* () {
    const data = yield defaultResponseHandler(response2);
    return {
      data,
      requestId: response2.headers.get(REQUEST_ID_HEADER) || ""
    };
  });
}
var retry = {};
var utils = {};
var __awaiter$5 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(utils, "__esModule", { value: true });
utils.ensureEndpointIdFormat = ensureEndpointIdFormat;
utils.parseEndpointId = parseEndpointId;
utils.resolveEndpointPath = resolveEndpointPath;
utils.isValidUrl = isValidUrl;
utils.throttle = throttle;
utils.isReact = isReact;
utils.isPlainObject = isPlainObject;
utils.sleep = sleep;
function ensureEndpointIdFormat(id) {
  const parts = id.split("/");
  if (parts.length > 1) {
    return id;
  }
  const [, appOwner, appId] = /^([0-9]+)-([a-zA-Z0-9-]+)$/.exec(id) || [];
  if (appOwner && appId) {
    return `${appOwner}/${appId}`;
  }
  throw new Error(`Invalid app id: ${id}. Must be in the format <appOwner>/<appId>`);
}
const ENDPOINT_NAMESPACES = ["workflows", "comfy"];
function parseEndpointId(id) {
  const normalizedId = ensureEndpointIdFormat(id);
  const parts = normalizedId.split("/");
  if (ENDPOINT_NAMESPACES.includes(parts[0])) {
    return {
      owner: parts[1],
      alias: parts[2],
      path: parts.slice(3).join("/") || void 0,
      namespace: parts[0]
    };
  }
  return {
    owner: parts[0],
    alias: parts[1],
    path: parts.slice(2).join("/") || void 0
  };
}
function resolveEndpointPath(app, path2, defaultPath) {
  if (path2) {
    return `/${path2.replace(/^\/+/, "")}`;
  }
  if (app.endsWith(defaultPath)) {
    return void 0;
  }
  return defaultPath;
}
function isValidUrl(url2) {
  try {
    const { host } = new URL(url2);
    return /(fal\.(ai|run))$/.test(host);
  } catch (_) {
    return false;
  }
}
function throttle(func, limit, leading = false) {
  let lastFunc;
  let lastRan;
  return (...args) => {
    if (!lastRan && leading) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}
let isRunningInReact;
function isReact() {
  if (isRunningInReact === void 0) {
    const stack2 = new Error().stack;
    isRunningInReact = !!stack2 && (stack2.includes("node_modules/react-dom/") || stack2.includes("node_modules/next/"));
  }
  return isRunningInReact;
}
function isPlainObject(value) {
  return !!value && Object.getPrototypeOf(value) === Object.prototype;
}
function sleep(ms) {
  return __awaiter$5(this, void 0, void 0, function* () {
    return new Promise((resolve) => setTimeout(resolve, ms));
  });
}
(function(exports) {
  var __awaiter2 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.DEFAULT_RETRY_OPTIONS = exports.DEFAULT_RETRYABLE_STATUS_CODES = void 0;
  exports.isRetryableNetworkError = isRetryableNetworkError;
  exports.isRetryableError = isRetryableError;
  exports.calculateBackoffDelay = calculateBackoffDelay;
  exports.executeWithRetry = executeWithRetry;
  const response_12 = response;
  const utils_12 = utils;
  exports.DEFAULT_RETRYABLE_STATUS_CODES = [429, 502, 503, 504];
  exports.DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1e3,
    maxDelay: 3e4,
    backoffMultiplier: 2,
    retryableStatusCodes: exports.DEFAULT_RETRYABLE_STATUS_CODES,
    enableJitter: true
  };
  const RETRYABLE_NETWORK_ERROR_CODES = /* @__PURE__ */ new Set([
    "ECONNABORTED",
    "ECONNREFUSED",
    "ECONNRESET",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
    "UND_ERR_BODY_TIMEOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET"
  ]);
  function isRetryableNetworkError(error) {
    if (!error || typeof error !== "object") {
      return false;
    }
    const seen = /* @__PURE__ */ new Set();
    let current = error;
    let sawTransportShape = false;
    while (current && typeof current === "object" && !seen.has(current)) {
      seen.add(current);
      const name2 = current.name;
      if (name2 === "AbortError" || name2 === "TimeoutError") {
        return false;
      }
      const code = current.code;
      if (typeof code === "string" && RETRYABLE_NETWORK_ERROR_CODES.has(code)) {
        sawTransportShape = true;
      }
      current = current.cause;
    }
    if (sawTransportShape) {
      return true;
    }
    if (error instanceof TypeError && typeof error.message === "string" && /fetch failed/i.test(error.message)) {
      return true;
    }
    return false;
  }
  function isRetryableError(error, retryableStatusCodes) {
    if (error instanceof response_12.ApiError) {
      if (error.isUserTimeout) {
        return false;
      }
      return retryableStatusCodes.includes(error.status);
    }
    return isRetryableNetworkError(error);
  }
  function calculateBackoffDelay(attempt, baseDelay, maxDelay, backoffMultiplier, enableJitter) {
    const exponentialDelay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
    if (enableJitter) {
      const jitter = 0.25 * exponentialDelay * (Math.random() * 2 - 1);
      return Math.max(0, exponentialDelay + jitter);
    }
    return exponentialDelay;
  }
  function executeWithRetry(operation, options, onRetry) {
    return __awaiter2(this, void 0, void 0, function* () {
      const metrics = {
        totalAttempts: 0,
        totalDelay: 0
      };
      let lastError;
      for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        metrics.totalAttempts++;
        try {
          const result = yield operation();
          return { result, metrics };
        } catch (error) {
          lastError = error;
          metrics.lastError = error;
          if (attempt === options.maxRetries || !isRetryableError(error, options.retryableStatusCodes)) {
            throw error;
          }
          const delay = calculateBackoffDelay(attempt, options.baseDelay, options.maxDelay, options.backoffMultiplier, options.enableJitter);
          metrics.totalDelay += delay;
          if (onRetry) {
            onRetry(attempt + 1, error, delay);
          }
          yield (0, utils_12.sleep)(delay);
        }
      }
      throw lastError;
    });
  }
})(retry);
var runtime = {};
const name = "@fal-ai/client";
const version = "1.10.1";
const require$$0$1 = {
  name,
  version
};
Object.defineProperty(runtime, "__esModule", { value: true });
runtime.isBrowser = isBrowser;
runtime.getUserAgent = getUserAgent;
function isBrowser() {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}
let memoizedUserAgent = null;
function getUserAgent() {
  if (memoizedUserAgent !== null) {
    return memoizedUserAgent;
  }
  const packageInfo = require$$0$1;
  memoizedUserAgent = `${packageInfo.name}/${packageInfo.version}`;
  return memoizedUserAgent;
}
(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.credentialsFromEnv = void 0;
  exports.resolveDefaultFetch = resolveDefaultFetch;
  exports.createConfig = createConfig;
  exports.getRestApiUrl = getRestApiUrl;
  const middleware_1 = middleware;
  const response_12 = response;
  const retry_12 = retry;
  const runtime_12 = runtime;
  function resolveDefaultFetch() {
    if (typeof fetch === "undefined") {
      throw new Error("Your environment does not support fetch. Please provide your own fetch implementation.");
    }
    return fetch;
  }
  function hasEnvVariables() {
    return typeof process !== "undefined" && process.env && (typeof process.env.FAL_KEY !== "undefined" || typeof process.env.FAL_KEY_ID !== "undefined" && typeof process.env.FAL_KEY_SECRET !== "undefined");
  }
  const credentialsFromEnv = () => {
    if (!hasEnvVariables()) {
      return void 0;
    }
    if (typeof process.env.FAL_KEY !== "undefined") {
      return process.env.FAL_KEY;
    }
    return process.env.FAL_KEY_ID ? `${process.env.FAL_KEY_ID}:${process.env.FAL_KEY_SECRET}` : void 0;
  };
  exports.credentialsFromEnv = credentialsFromEnv;
  const DEFAULT_CONFIG = {
    credentials: exports.credentialsFromEnv,
    suppressLocalCredentialsWarning: false,
    requestMiddleware: (request2) => Promise.resolve(request2),
    responseHandler: response_12.defaultResponseHandler,
    retry: retry_12.DEFAULT_RETRY_OPTIONS
  };
  function createConfig(config2) {
    var _a;
    let configuration = Object.assign(Object.assign(Object.assign({}, DEFAULT_CONFIG), config2), {
      fetch: (_a = config2.fetch) !== null && _a !== void 0 ? _a : resolveDefaultFetch(),
      // Merge retry configuration with defaults
      retry: Object.assign(Object.assign({}, retry_12.DEFAULT_RETRY_OPTIONS), config2.retry || {})
    });
    if (config2.proxyUrl) {
      const proxy = typeof config2.proxyUrl === "string" ? { url: config2.proxyUrl } : config2.proxyUrl;
      configuration = Object.assign(Object.assign({}, configuration), { requestMiddleware: (0, middleware_1.withMiddleware)(configuration.requestMiddleware, (0, middleware_1.withProxy)({ targetUrl: proxy.url, when: proxy.when })) });
    }
    const { credentials: resolveCredentials, suppressLocalCredentialsWarning } = configuration;
    const credentials = typeof resolveCredentials === "function" ? resolveCredentials() : resolveCredentials;
    if ((0, runtime_12.isBrowser)() && credentials && !suppressLocalCredentialsWarning) {
      console.warn("The fal credentials are exposed in the browser's environment. That's not recommended for production use cases.");
    }
    return configuration;
  }
  function getRestApiUrl() {
    return "https://rest.fal.ai";
  }
})(config);
var queue = {};
var request = {};
var __awaiter$4 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __rest$1 = commonjsGlobal && commonjsGlobal.__rest || function(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
};
Object.defineProperty(request, "__esModule", { value: true });
request.dispatchRequest = dispatchRequest;
request.buildUrl = buildUrl;
const retry_1$1 = retry;
const runtime_1$1 = runtime;
const utils_1$3 = utils;
const isCloudflareWorkers = typeof navigator !== "undefined" && (navigator === null || navigator === void 0 ? void 0 : navigator.userAgent) === "Cloudflare-Workers";
function dispatchRequest(params) {
  return __awaiter$4(this, void 0, void 0, function* () {
    var _a;
    const { targetUrl, input, config: config2, options = {} } = params;
    const { credentials: credentialsValue, requestMiddleware, responseHandler, fetch: fetch2 } = config2;
    const retryOptions = Object.assign(Object.assign({}, config2.retry), options.retry || {});
    const executeRequest = () => __awaiter$4(this, void 0, void 0, function* () {
      var _a2, _b, _c;
      const userAgent = (0, runtime_1$1.isBrowser)() ? {} : { "User-Agent": (0, runtime_1$1.getUserAgent)() };
      const credentials = typeof credentialsValue === "function" ? credentialsValue() : credentialsValue;
      const { method, url: url2, headers: headers2 } = yield requestMiddleware({
        method: ((_b = (_a2 = params.method) !== null && _a2 !== void 0 ? _a2 : options.method) !== null && _b !== void 0 ? _b : "post").toUpperCase(),
        url: targetUrl,
        headers: params.headers
      });
      const authHeader = credentials ? { Authorization: `Key ${credentials}` } : {};
      const requestHeaders = Object.assign(Object.assign(Object.assign(Object.assign({}, authHeader), { Accept: "application/json", "Content-Type": "application/json" }), userAgent), headers2 !== null && headers2 !== void 0 ? headers2 : {});
      const { responseHandler: customResponseHandler, retry: _ } = options, requestInit = __rest$1(options, ["responseHandler", "retry"]);
      const response2 = yield fetch2(url2, Object.assign(Object.assign(Object.assign(Object.assign({}, requestInit), { method, headers: Object.assign(Object.assign({}, requestHeaders), (_c = requestInit.headers) !== null && _c !== void 0 ? _c : {}) }), !isCloudflareWorkers && { mode: "cors" }), { signal: options.signal, body: method.toLowerCase() !== "get" && input ? JSON.stringify(input) : void 0 }));
      const handleResponse = customResponseHandler !== null && customResponseHandler !== void 0 ? customResponseHandler : responseHandler;
      return yield handleResponse(response2);
    });
    let lastError;
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return yield executeRequest();
      } catch (error) {
        lastError = error;
        const shouldNotRetry = attempt === retryOptions.maxRetries || !(0, retry_1$1.isRetryableError)(error, retryOptions.retryableStatusCodes) || ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted);
        if (shouldNotRetry) {
          throw error;
        }
        const delay = (0, retry_1$1.calculateBackoffDelay)(attempt, retryOptions.baseDelay, retryOptions.maxDelay, retryOptions.backoffMultiplier, retryOptions.enableJitter);
        yield (0, utils_1$3.sleep)(delay);
      }
    }
    throw lastError;
  });
}
function buildUrl(id, options = {}) {
  var _a, _b;
  const method = ((_a = options.method) !== null && _a !== void 0 ? _a : "post").toLowerCase();
  const path2 = ((_b = options.path) !== null && _b !== void 0 ? _b : "").replace(/^\//, "").replace(/\/{2,}/, "/");
  const input = options.input;
  const params = Object.assign(Object.assign({}, options.query || {}), method === "get" ? input : {});
  const queryParams = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
  if ((0, utils_1$3.isValidUrl)(id)) {
    const url3 = id.endsWith("/") ? id : `${id}/`;
    return `${url3}${path2}${queryParams}`;
  }
  const appId = (0, utils_1$3.ensureEndpointIdFormat)(id);
  const subdomain = options.subdomain ? `${options.subdomain}.` : "";
  const url2 = `https://${subdomain}fal.run/${appId}/${path2}`;
  return `${url2.replace(/\/$/, "")}${queryParams}`;
}
var storage = {};
(function(exports) {
  var __awaiter2 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.OBJECT_LIFECYCYLE_PREFERENCE_HEADER = void 0;
  exports.getExpirationDurationSeconds = getExpirationDurationSeconds;
  exports.buildObjectLifecycleHeaders = buildObjectLifecycleHeaders;
  exports.createStorageClient = createStorageClient;
  const config_12 = config;
  const request_12 = request;
  const utils_12 = utils;
  exports.OBJECT_LIFECYCYLE_PREFERENCE_HEADER = "x-fal-object-lifecycle-preference";
  const EXPIRATION_VALUES = {
    never: void 0,
    immediate: 60,
    "1h": 3600,
    "1d": 86400,
    "7d": 604800,
    "30d": 2592e3,
    "1y": 31536e3
  };
  function getExpirationDurationSeconds(lifecycle) {
    const { expiresIn } = lifecycle;
    if (expiresIn === void 0) {
      return void 0;
    }
    return typeof expiresIn === "number" ? expiresIn : EXPIRATION_VALUES[expiresIn];
  }
  function buildUploadLifecycleConfig(lifecycle) {
    if (!lifecycle) {
      return void 0;
    }
    const expirationDurationSeconds = getExpirationDurationSeconds(lifecycle);
    const lifecycleConfig = {};
    if (expirationDurationSeconds !== void 0) {
      lifecycleConfig.expiration_duration_seconds = expirationDurationSeconds;
    }
    if (lifecycle.initialAcl !== void 0) {
      lifecycleConfig.initial_acl = lifecycle.initialAcl;
    }
    return Object.keys(lifecycleConfig).length > 0 ? lifecycleConfig : void 0;
  }
  function buildObjectLifecycleHeaders(lifecycle) {
    const lifecycleConfig = buildUploadLifecycleConfig(lifecycle);
    if (!lifecycleConfig) {
      return {};
    }
    return {
      [exports.OBJECT_LIFECYCYLE_PREFERENCE_HEADER]: JSON.stringify(lifecycleConfig)
    };
  }
  function getExtensionFromContentType(contentType) {
    var _a;
    const [, fileType] = contentType.split("/");
    return (_a = fileType.split(/[-;]/)[0]) !== null && _a !== void 0 ? _a : "bin";
  }
  function initiateUpload(file, config2, contentType, lifecycle) {
    return __awaiter2(this, void 0, void 0, function* () {
      const filename = file.name || `${Date.now()}.${getExtensionFromContentType(contentType)}`;
      const headers2 = {};
      const lifecycleConfig = buildUploadLifecycleConfig(lifecycle);
      if (lifecycleConfig) {
        headers2["X-Fal-Object-Lifecycle"] = JSON.stringify(lifecycleConfig);
      }
      return yield (0, request_12.dispatchRequest)({
        method: "POST",
        // NOTE: We want to test V3 without making it the default at the API level
        targetUrl: `${(0, config_12.getRestApiUrl)()}/storage/upload/initiate?storage_type=fal-cdn-v3`,
        input: {
          content_type: contentType,
          file_name: filename
        },
        config: config2,
        headers: headers2
      });
    });
  }
  function initiateMultipartUpload(file, config2, contentType, lifecycle) {
    return __awaiter2(this, void 0, void 0, function* () {
      const filename = file.name || `${Date.now()}.${getExtensionFromContentType(contentType)}`;
      const headers2 = {};
      const lifecycleConfig = buildUploadLifecycleConfig(lifecycle);
      if (lifecycleConfig) {
        headers2["X-Fal-Object-Lifecycle"] = JSON.stringify(lifecycleConfig);
      }
      return yield (0, request_12.dispatchRequest)({
        method: "POST",
        targetUrl: `${(0, config_12.getRestApiUrl)()}/storage/upload/initiate-multipart?storage_type=fal-cdn-v3`,
        input: {
          content_type: contentType,
          file_name: filename
        },
        config: config2,
        headers: headers2
      });
    });
  }
  function partUploadRetries(uploadUrl_1, chunk_1, config_2) {
    return __awaiter2(this, arguments, void 0, function* (uploadUrl, chunk, config2, tries = 3) {
      if (tries === 0) {
        throw new Error("Part upload failed, retries exhausted");
      }
      const { fetch: fetch2, responseHandler } = config2;
      try {
        const response2 = yield fetch2(uploadUrl, {
          method: "PUT",
          body: chunk
        });
        return yield responseHandler(response2);
      } catch (error) {
        return yield partUploadRetries(uploadUrl, chunk, config2, tries - 1);
      }
    });
  }
  function multipartUpload(file, config2, lifecycle) {
    return __awaiter2(this, void 0, void 0, function* () {
      const { fetch: fetch2, responseHandler } = config2;
      const contentType = file.type || "application/octet-stream";
      const { upload_url: uploadUrl, file_url: url2 } = yield initiateMultipartUpload(file, config2, contentType, lifecycle);
      const chunkSize = 10 * 1024 * 1024;
      const chunks = Math.ceil(file.size / chunkSize);
      const parsedUrl = new URL(uploadUrl);
      const responses = [];
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;
        const partUploadUrl = `${parsedUrl.origin}${parsedUrl.pathname}/${partNumber}${parsedUrl.search}`;
        responses.push(yield partUploadRetries(partUploadUrl, chunk, config2));
      }
      const completeUrl = `${parsedUrl.origin}${parsedUrl.pathname}/complete${parsedUrl.search}`;
      const response2 = yield fetch2(completeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parts: responses.map((mpart) => ({
            partNumber: mpart.partNumber,
            etag: mpart.etag
          }))
        })
      });
      yield responseHandler(response2);
      return url2;
    });
  }
  function createStorageClient({ config: config2 }) {
    const ref = {
      upload: (file, options) => __awaiter2(this, void 0, void 0, function* () {
        const lifecycle = options === null || options === void 0 ? void 0 : options.lifecycle;
        if (file.size > 90 * 1024 * 1024) {
          return yield multipartUpload(file, config2, lifecycle);
        }
        const contentType = file.type || "application/octet-stream";
        const { fetch: fetch2, responseHandler } = config2;
        const { upload_url: uploadUrl, file_url: url2 } = yield initiateUpload(file, config2, contentType, lifecycle);
        const response2 = yield fetch2(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          }
        });
        yield responseHandler(response2);
        return url2;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformInput: (input) => __awaiter2(this, void 0, void 0, function* () {
        if (Array.isArray(input)) {
          return Promise.all(input.map((item) => ref.transformInput(item)));
        } else if (input instanceof Blob) {
          return yield ref.upload(input);
        } else if ((0, utils_12.isPlainObject)(input)) {
          const inputObject = input;
          const promises = Object.entries(inputObject).map((_a) => __awaiter2(this, [_a], void 0, function* ([key, value]) {
            return [key, yield ref.transformInput(value)];
          }));
          const results = yield Promise.all(promises);
          return Object.fromEntries(results);
        }
        return input;
      })
    };
    return ref;
  }
})(storage);
var streaming = {};
var dist = {};
Object.defineProperty(dist, "__esModule", {
  value: true
});
function createParser(onParse) {
  let isFirstChunk;
  let buffer;
  let startingPosition;
  let startingFieldLength;
  let eventId;
  let eventName;
  let data;
  reset();
  return {
    feed,
    reset
  };
  function reset() {
    isFirstChunk = true;
    buffer = "";
    startingPosition = 0;
    startingFieldLength = -1;
    eventId = void 0;
    eventName = void 0;
    data = "";
  }
  function feed(chunk) {
    buffer = buffer ? buffer + chunk : chunk;
    if (isFirstChunk && hasBom(buffer)) {
      buffer = buffer.slice(BOM.length);
    }
    isFirstChunk = false;
    const length = buffer.length;
    let position = 0;
    let discardTrailingNewline = false;
    while (position < length) {
      if (discardTrailingNewline) {
        if (buffer[position] === "\n") {
          ++position;
        }
        discardTrailingNewline = false;
      }
      let lineLength = -1;
      let fieldLength = startingFieldLength;
      let character;
      for (let index = startingPosition; lineLength < 0 && index < length; ++index) {
        character = buffer[index];
        if (character === ":" && fieldLength < 0) {
          fieldLength = index - position;
        } else if (character === "\r") {
          discardTrailingNewline = true;
          lineLength = index - position;
        } else if (character === "\n") {
          lineLength = index - position;
        }
      }
      if (lineLength < 0) {
        startingPosition = length - position;
        startingFieldLength = fieldLength;
        break;
      } else {
        startingPosition = 0;
        startingFieldLength = -1;
      }
      parseEventStreamLine(buffer, position, fieldLength, lineLength);
      position += lineLength + 1;
    }
    if (position === length) {
      buffer = "";
    } else if (position > 0) {
      buffer = buffer.slice(position);
    }
  }
  function parseEventStreamLine(lineBuffer, index, fieldLength, lineLength) {
    if (lineLength === 0) {
      if (data.length > 0) {
        onParse({
          type: "event",
          id: eventId,
          event: eventName || void 0,
          data: data.slice(0, -1)
          // remove trailing newline
        });
        data = "";
        eventId = void 0;
      }
      eventName = void 0;
      return;
    }
    const noValue = fieldLength < 0;
    const field = lineBuffer.slice(index, index + (noValue ? lineLength : fieldLength));
    let step = 0;
    if (noValue) {
      step = lineLength;
    } else if (lineBuffer[index + fieldLength + 1] === " ") {
      step = fieldLength + 2;
    } else {
      step = fieldLength + 1;
    }
    const position = index + step;
    const valueLength = lineLength - step;
    const value = lineBuffer.slice(position, position + valueLength).toString();
    if (field === "data") {
      data += value ? "".concat(value, "\n") : "\n";
    } else if (field === "event") {
      eventName = value;
    } else if (field === "id" && !value.includes("\0")) {
      eventId = value;
    } else if (field === "retry") {
      const retry2 = parseInt(value, 10);
      if (!Number.isNaN(retry2)) {
        onParse({
          type: "reconnect-interval",
          value: retry2
        });
      }
    }
  }
}
const BOM = [239, 187, 191];
function hasBom(buffer) {
  return BOM.every((charCode, index) => buffer.charCodeAt(index) === charCode);
}
dist.createParser = createParser;
var auth = {};
(function(exports) {
  var __awaiter2 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.TOKEN_EXPIRATION_SECONDS = void 0;
  exports.getTemporaryAuthToken = getTemporaryAuthToken;
  const config_12 = config;
  const request_12 = request;
  const utils_12 = utils;
  exports.TOKEN_EXPIRATION_SECONDS = 120;
  function getTemporaryAuthToken(app, config2) {
    return __awaiter2(this, void 0, void 0, function* () {
      const appId = (0, utils_12.parseEndpointId)(app);
      const token = yield (0, request_12.dispatchRequest)({
        method: "POST",
        targetUrl: `${(0, config_12.getRestApiUrl)()}/tokens/`,
        config: config2,
        input: {
          allowed_apps: [appId.alias],
          token_expiration: exports.TOKEN_EXPIRATION_SECONDS
        }
      });
      if (typeof token !== "string" && token["detail"]) {
        return token["detail"];
      }
      return token;
    });
  }
})(auth);
var __awaiter$3 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __await = commonjsGlobal && commonjsGlobal.__await || function(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
};
var __asyncGenerator = commonjsGlobal && commonjsGlobal.__asyncGenerator || function(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = {}, verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
};
Object.defineProperty(streaming, "__esModule", { value: true });
streaming.FalStream = void 0;
streaming.createStreamingClient = createStreamingClient;
const eventsource_parser_1 = dist;
const auth_1$1 = auth;
const request_1$2 = request;
const response_1$3 = response;
const utils_1$2 = utils;
const CONTENT_TYPE_EVENT_STREAM = "text/event-stream";
const EVENT_STREAM_TIMEOUT = 15 * 1e3;
class FalStream {
  constructor(endpointId, config2, options) {
    var _a;
    this.listeners = /* @__PURE__ */ new Map();
    this.buffer = [];
    this.currentData = void 0;
    this.lastEventTimestamp = 0;
    this.streamClosed = false;
    this._requestId = null;
    this.abortController = new AbortController();
    this.start = () => __awaiter$3(this, void 0, void 0, function* () {
      var _a2, _b, _c;
      const { endpointId: endpointId2, options: options2 } = this;
      const { input, method = "post", connectionMode = "server", tokenProvider } = options2;
      try {
        if (connectionMode === "client") {
          const appId = (0, utils_1$2.ensureEndpointIdFormat)(endpointId2);
          const resolvedPath = (_a2 = (0, utils_1$2.resolveEndpointPath)(endpointId2, void 0, "/stream")) !== null && _a2 !== void 0 ? _a2 : "";
          const fetchToken = tokenProvider ? () => tokenProvider(`${appId}${resolvedPath}`) : () => {
            console.warn('[fal.stream] Using the default token provider is deprecated. Please provide a `tokenProvider` function when using `connectionMode: "client"`. See https://docs.fal.ai/fal-client/authentication for more information.');
            return (0, auth_1$1.getTemporaryAuthToken)(endpointId2, this.config);
          };
          const token = yield fetchToken();
          const { fetch: fetch2 } = this.config;
          const parsedUrl = new URL(this.url);
          parsedUrl.searchParams.set("fal_jwt_token", token);
          const response2 = yield fetch2(parsedUrl.toString(), {
            method: method.toUpperCase(),
            headers: {
              accept: (_b = options2.accept) !== null && _b !== void 0 ? _b : CONTENT_TYPE_EVENT_STREAM,
              "content-type": "application/json"
            },
            body: input && method !== "get" ? JSON.stringify(input) : void 0,
            signal: this.abortController.signal
          });
          this._requestId = response2.headers.get("x-fal-request-id");
          return yield this.handleResponse(response2);
        }
        return yield (0, request_1$2.dispatchRequest)({
          method: method.toUpperCase(),
          targetUrl: this.url,
          input,
          config: this.config,
          options: {
            headers: {
              accept: (_c = options2.accept) !== null && _c !== void 0 ? _c : CONTENT_TYPE_EVENT_STREAM
            },
            responseHandler: (response2) => __awaiter$3(this, void 0, void 0, function* () {
              this._requestId = response2.headers.get("x-fal-request-id");
              return yield this.handleResponse(response2);
            }),
            signal: this.abortController.signal
          }
        });
      } catch (error) {
        this.handleError(error);
      }
    });
    this.handleResponse = (response2) => __awaiter$3(this, void 0, void 0, function* () {
      var _a2, _b;
      if (!response2.ok) {
        try {
          yield (0, response_1$3.defaultResponseHandler)(response2);
        } catch (error) {
          this.emit("error", error);
        }
        return;
      }
      const body = response2.body;
      if (!body) {
        this.emit("error", new response_1$3.ApiError({
          message: "Response body is empty.",
          status: 400,
          body: void 0,
          requestId: this._requestId || void 0
        }));
        return;
      }
      const isEventStream = ((_a2 = response2.headers.get("content-type")) !== null && _a2 !== void 0 ? _a2 : "").startsWith(CONTENT_TYPE_EVENT_STREAM);
      if (!isEventStream) {
        const reader2 = body.getReader();
        const emitRawChunk = () => {
          reader2.read().then(({ done, value }) => {
            if (done) {
              this.emit("done", this.currentData);
              return;
            }
            this.buffer.push(value);
            this.currentData = value;
            this.emit("data", value);
            emitRawChunk();
          });
        };
        emitRawChunk();
        return;
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response2.body.getReader();
      const parser = (0, eventsource_parser_1.createParser)((event) => {
        if (event.type === "event") {
          const data = event.data;
          try {
            const parsedData = JSON.parse(data);
            this.buffer.push(parsedData);
            this.currentData = parsedData;
            this.emit("data", parsedData);
            this.emit("message", parsedData);
          } catch (e) {
            this.emit("error", e);
          }
        }
      });
      const timeout = (_b = this.options.timeout) !== null && _b !== void 0 ? _b : EVENT_STREAM_TIMEOUT;
      const readPartialResponse = () => __awaiter$3(this, void 0, void 0, function* () {
        const { value, done } = yield reader.read();
        this.lastEventTimestamp = Date.now();
        parser.feed(decoder.decode(value));
        if (Date.now() - this.lastEventTimestamp > timeout) {
          this.emit("error", new response_1$3.ApiError({
            message: `Event stream timed out after ${(timeout / 1e3).toFixed(0)} seconds with no messages.`,
            status: 408,
            requestId: this._requestId || void 0
          }));
        }
        if (!done) {
          readPartialResponse().catch(this.handleError);
        } else {
          this.emit("done", this.currentData);
        }
      });
      readPartialResponse().catch(this.handleError);
      return;
    });
    this.handleError = (error) => {
      var _a2;
      if (error.name === "AbortError" || this.signal.aborted) {
        return;
      }
      const apiError = error instanceof response_1$3.ApiError ? error : new response_1$3.ApiError({
        message: (_a2 = error.message) !== null && _a2 !== void 0 ? _a2 : "An unknown error occurred",
        status: 500,
        requestId: this._requestId || void 0
      });
      this.emit("error", apiError);
      return;
    };
    this.on = (type, listener) => {
      var _a2;
      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      (_a2 = this.listeners.get(type)) === null || _a2 === void 0 ? void 0 : _a2.push(listener);
    };
    this.emit = (type, event) => {
      const listeners = this.listeners.get(type) || [];
      for (const listener of listeners) {
        listener(event);
      }
    };
    this.done = () => __awaiter$3(this, void 0, void 0, function* () {
      return this.donePromise;
    });
    this.abort = (reason) => {
      if (!this.streamClosed) {
        this.abortController.abort(reason);
      }
    };
    this.endpointId = endpointId;
    this.config = config2;
    this.url = (_a = options.url) !== null && _a !== void 0 ? _a : (0, request_1$2.buildUrl)(endpointId, {
      path: (0, utils_1$2.resolveEndpointPath)(endpointId, void 0, "/stream"),
      query: options.queryParams
    });
    this.options = options;
    this.donePromise = new Promise((resolve, reject) => {
      if (this.streamClosed) {
        reject(new response_1$3.ApiError({
          message: "Streaming connection is already closed.",
          status: 400,
          body: void 0,
          requestId: this._requestId || void 0
        }));
      }
      this.signal.addEventListener("abort", () => {
        var _a2;
        resolve((_a2 = this.currentData) !== null && _a2 !== void 0 ? _a2 : {});
      });
      this.on("done", (data) => {
        this.streamClosed = true;
        resolve(data);
      });
      this.on("error", (error) => {
        this.streamClosed = true;
        reject(error);
      });
    });
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        this.abortController.abort();
      });
    }
    this.start().catch(this.handleError);
  }
  [Symbol.asyncIterator]() {
    return __asyncGenerator(this, arguments, function* _a() {
      let running = true;
      const stopAsyncIterator = () => running = false;
      this.on("error", stopAsyncIterator);
      this.on("done", stopAsyncIterator);
      while (running || this.buffer.length > 0) {
        const data = this.buffer.shift();
        if (data) {
          yield yield __await(data);
        }
        yield __await(new Promise((resolve) => setTimeout(resolve, 16)));
      }
    });
  }
  /**
   * Gets the `AbortSignal` instance that can be used to listen for abort events.
   *
   * **Note:** this signal is internal to the `FalStream` instance. If you pass your
   * own abort signal, the `FalStream` will listen to it and abort it appropriately.
   *
   * @returns the `AbortSignal` instance.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
   */
  get signal() {
    return this.abortController.signal;
  }
  /**
   * Gets the request id of the streaming request.
   *
   * @returns the request id.
   */
  get requestId() {
    return this._requestId;
  }
}
streaming.FalStream = FalStream;
function createStreamingClient({ config: config2, storage: storage2 }) {
  return {
    stream(endpointId, options) {
      return __awaiter$3(this, void 0, void 0, function* () {
        const input = options.input ? yield storage2.transformInput(options.input) : void 0;
        return new FalStream(endpointId, config2, Object.assign(Object.assign({}, options), { input }));
      });
    }
  };
}
var __awaiter$2 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __rest = commonjsGlobal && commonjsGlobal.__rest || function(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
};
Object.defineProperty(queue, "__esModule", { value: true });
queue.createQueueClient = void 0;
const headers_1$1 = headers;
const request_1$1 = request;
const response_1$2 = response;
const retry_1 = retry;
const storage_1$1 = storage;
const streaming_1$1 = streaming;
const utils_1$1 = utils;
const DEFAULT_POLL_INTERVAL = 500;
const QUEUE_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1e3,
  maxDelay: 6e4,
  retryableStatusCodes: retry_1.DEFAULT_RETRYABLE_STATUS_CODES
};
const QUEUE_STATUS_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1e3,
  maxDelay: 3e4,
  retryableStatusCodes: [...retry_1.DEFAULT_RETRYABLE_STATUS_CODES, 500]
};
const createQueueClient = ({ config: config2, storage: storage2 }) => {
  const ref = {
    submit(endpointId, options) {
      return __awaiter$2(this, void 0, void 0, function* () {
        const { webhookUrl, priority, hint, startTimeout, headers: headers2, storageSettings } = options, runOptions = __rest(options, ["webhookUrl", "priority", "hint", "startTimeout", "headers", "storageSettings"]);
        const input = options.input ? yield storage2.transformInput(options.input) : void 0;
        const extraHeaders = Object.fromEntries(Object.entries(headers2 !== null && headers2 !== void 0 ? headers2 : {}).map(([key, value]) => [
          key.toLowerCase(),
          value
        ]));
        return (0, request_1$1.dispatchRequest)({
          method: options.method,
          targetUrl: (0, request_1$1.buildUrl)(endpointId, Object.assign(Object.assign({}, runOptions), { subdomain: "queue", query: webhookUrl ? { fal_webhook: webhookUrl } : void 0 })),
          headers: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, extraHeaders), (0, storage_1$1.buildObjectLifecycleHeaders)(storageSettings)), { [headers_1$1.QUEUE_PRIORITY_HEADER]: priority !== null && priority !== void 0 ? priority : "normal" }), hint && { [headers_1$1.RUNNER_HINT_HEADER]: hint }), (0, headers_1$1.buildTimeoutHeaders)(startTimeout)),
          input,
          config: config2,
          options: {
            signal: options.abortSignal,
            retry: QUEUE_RETRY_CONFIG
          }
        });
      });
    },
    status(endpointId_1, _a) {
      return __awaiter$2(this, arguments, void 0, function* (endpointId, { requestId, logs = false, abortSignal }) {
        const appId = (0, utils_1$1.parseEndpointId)(endpointId);
        const prefix = appId.namespace ? `${appId.namespace}/` : "";
        return (0, request_1$1.dispatchRequest)({
          method: "get",
          targetUrl: (0, request_1$1.buildUrl)(`${prefix}${appId.owner}/${appId.alias}`, {
            subdomain: "queue",
            query: { logs: logs ? "1" : "0" },
            path: `/requests/${requestId}/status`
          }),
          config: config2,
          options: {
            signal: abortSignal,
            retry: QUEUE_STATUS_RETRY_CONFIG
          }
        });
      });
    },
    streamStatus(endpointId_1, _a) {
      return __awaiter$2(this, arguments, void 0, function* (endpointId, { requestId, logs = false, connectionMode }) {
        const appId = (0, utils_1$1.parseEndpointId)(endpointId);
        const prefix = appId.namespace ? `${appId.namespace}/` : "";
        const queryParams = {
          logs: logs ? "1" : "0"
        };
        const url2 = (0, request_1$1.buildUrl)(`${prefix}${appId.owner}/${appId.alias}`, {
          subdomain: "queue",
          path: `/requests/${requestId}/status/stream`,
          query: queryParams
        });
        return new streaming_1$1.FalStream(endpointId, config2, {
          url: url2,
          method: "get",
          connectionMode,
          queryParams
        });
      });
    },
    subscribeToStatus(endpointId, options) {
      return __awaiter$2(this, void 0, void 0, function* () {
        const requestId = options.requestId;
        const timeout = options.timeout;
        let timeoutId = void 0;
        const handleCancelError = () => {
        };
        if (options.mode === "streaming") {
          const status = yield ref.streamStatus(endpointId, {
            requestId,
            logs: options.logs,
            connectionMode: "connectionMode" in options ? options.connectionMode : void 0
          });
          const logs = [];
          if (timeout) {
            timeoutId = setTimeout(() => {
              status.abort();
              ref.cancel(endpointId, { requestId }).catch(handleCancelError);
              throw new Error(`Client timed out waiting for the request to complete after ${timeout}ms`);
            }, timeout);
          }
          status.on("data", (data) => {
            if (options.onQueueUpdate) {
              if ("logs" in data && Array.isArray(data.logs) && data.logs.length > 0) {
                logs.push(...data.logs);
              }
              options.onQueueUpdate("logs" in data ? Object.assign(Object.assign({}, data), { logs }) : data);
            }
          });
          const doneStatus = yield status.done();
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return doneStatus;
        }
        return new Promise((resolve, reject) => {
          var _a;
          let pollingTimeoutId;
          const pollInterval = "pollInterval" in options && typeof options.pollInterval === "number" ? (_a = options.pollInterval) !== null && _a !== void 0 ? _a : DEFAULT_POLL_INTERVAL : DEFAULT_POLL_INTERVAL;
          const clearScheduledTasks = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (pollingTimeoutId) {
              clearTimeout(pollingTimeoutId);
            }
          };
          if (timeout) {
            timeoutId = setTimeout(() => {
              clearScheduledTasks();
              ref.cancel(endpointId, { requestId }).catch(handleCancelError);
              reject(new Error(`Client timed out waiting for the request to complete after ${timeout}ms`));
            }, timeout);
          }
          const poll = () => __awaiter$2(this, void 0, void 0, function* () {
            var _a2;
            try {
              const requestStatus = yield ref.status(endpointId, {
                requestId,
                logs: (_a2 = options.logs) !== null && _a2 !== void 0 ? _a2 : false,
                abortSignal: options.abortSignal
              });
              if (options.onQueueUpdate) {
                options.onQueueUpdate(requestStatus);
              }
              if (requestStatus.status === "COMPLETED") {
                clearScheduledTasks();
                resolve(requestStatus);
                return;
              }
              pollingTimeoutId = setTimeout(poll, pollInterval);
            } catch (error) {
              clearScheduledTasks();
              reject(error);
            }
          });
          poll().catch(reject);
        });
      });
    },
    result(endpointId_1, _a) {
      return __awaiter$2(this, arguments, void 0, function* (endpointId, { requestId, abortSignal }) {
        const appId = (0, utils_1$1.parseEndpointId)(endpointId);
        const prefix = appId.namespace ? `${appId.namespace}/` : "";
        return (0, request_1$1.dispatchRequest)({
          method: "get",
          targetUrl: (0, request_1$1.buildUrl)(`${prefix}${appId.owner}/${appId.alias}`, {
            subdomain: "queue",
            path: `/requests/${requestId}`
          }),
          config: Object.assign(Object.assign({}, config2), { responseHandler: response_1$2.resultResponseHandler }),
          options: {
            signal: abortSignal,
            retry: QUEUE_RETRY_CONFIG
          }
        });
      });
    },
    cancel(endpointId_1, _a) {
      return __awaiter$2(this, arguments, void 0, function* (endpointId, { requestId, abortSignal }) {
        const appId = (0, utils_1$1.parseEndpointId)(endpointId);
        const prefix = appId.namespace ? `${appId.namespace}/` : "";
        yield (0, request_1$1.dispatchRequest)({
          method: "put",
          targetUrl: (0, request_1$1.buildUrl)(`${prefix}${appId.owner}/${appId.alias}`, {
            subdomain: "queue",
            path: `/requests/${requestId}/cancel`
          }),
          config: config2,
          options: {
            signal: abortSignal
          }
        });
      });
    }
  };
  return ref;
};
queue.createQueueClient = createQueueClient;
var realtime = {};
function utf8Count(str) {
  const strLength = str.length;
  let byteLength = 0;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      byteLength++;
      continue;
    } else if ((value & 4294965248) === 0) {
      byteLength += 2;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        byteLength += 3;
      } else {
        byteLength += 4;
      }
    }
  }
  return byteLength;
}
function utf8EncodeJs(str, output, outputOffset) {
  const strLength = str.length;
  let offset = outputOffset;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      output[offset++] = value;
      continue;
    } else if ((value & 4294965248) === 0) {
      output[offset++] = value >> 6 & 31 | 192;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        output[offset++] = value >> 12 & 15 | 224;
        output[offset++] = value >> 6 & 63 | 128;
      } else {
        output[offset++] = value >> 18 & 7 | 240;
        output[offset++] = value >> 12 & 63 | 128;
        output[offset++] = value >> 6 & 63 | 128;
      }
    }
    output[offset++] = value & 63 | 128;
  }
}
const sharedTextEncoder = new TextEncoder();
const TEXT_ENCODER_THRESHOLD = 50;
function utf8EncodeTE(str, output, outputOffset) {
  sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
}
function utf8Encode(str, output, outputOffset) {
  if (str.length > TEXT_ENCODER_THRESHOLD) {
    utf8EncodeTE(str, output, outputOffset);
  } else {
    utf8EncodeJs(str, output, outputOffset);
  }
}
const CHUNK_SIZE = 4096;
function utf8DecodeJs(bytes, inputOffset, byteLength) {
  let offset = inputOffset;
  const end = offset + byteLength;
  const units = [];
  let result = "";
  while (offset < end) {
    const byte1 = bytes[offset++];
    if ((byte1 & 128) === 0) {
      units.push(byte1);
    } else if ((byte1 & 224) === 192) {
      const byte2 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 6 | byte2);
    } else if ((byte1 & 240) === 224) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
    } else if ((byte1 & 248) === 240) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      const byte4 = bytes[offset++] & 63;
      let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
      if (unit > 65535) {
        unit -= 65536;
        units.push(unit >>> 10 & 1023 | 55296);
        unit = 56320 | unit & 1023;
      }
      units.push(unit);
    } else {
      units.push(byte1);
    }
    if (units.length >= CHUNK_SIZE) {
      result += String.fromCharCode(...units);
      units.length = 0;
    }
  }
  if (units.length > 0) {
    result += String.fromCharCode(...units);
  }
  return result;
}
const sharedTextDecoder = new TextDecoder();
const TEXT_DECODER_THRESHOLD = 200;
function utf8DecodeTD(bytes, inputOffset, byteLength) {
  const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
  return sharedTextDecoder.decode(stringBytes);
}
function utf8Decode(bytes, inputOffset, byteLength) {
  if (byteLength > TEXT_DECODER_THRESHOLD) {
    return utf8DecodeTD(bytes, inputOffset, byteLength);
  } else {
    return utf8DecodeJs(bytes, inputOffset, byteLength);
  }
}
class ExtData {
  constructor(type, data) {
    __publicField(this, "type");
    __publicField(this, "data");
    this.type = type;
    this.data = data;
  }
}
class DecodeError extends Error {
  constructor(message) {
    super(message);
    const proto = Object.create(DecodeError.prototype);
    Object.setPrototypeOf(this, proto);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: DecodeError.name
    });
  }
}
const UINT32_MAX = 4294967295;
function setUint64(view, offset, value) {
  const high = value / 4294967296;
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function setInt64(view, offset, value) {
  const high = Math.floor(value / 4294967296);
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function getInt64(view, offset) {
  const high = view.getInt32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}
function getUint64(view, offset) {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}
const EXT_TIMESTAMP = -1;
const TIMESTAMP32_MAX_SEC = 4294967296 - 1;
const TIMESTAMP64_MAX_SEC = 17179869184 - 1;
function encodeTimeSpecToTimestamp({ sec, nsec }) {
  if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
    if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
      const rv = new Uint8Array(4);
      const view = new DataView(rv.buffer);
      view.setUint32(0, sec);
      return rv;
    } else {
      const secHigh = sec / 4294967296;
      const secLow = sec & 4294967295;
      const rv = new Uint8Array(8);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec << 2 | secHigh & 3);
      view.setUint32(4, secLow);
      return rv;
    }
  } else {
    const rv = new Uint8Array(12);
    const view = new DataView(rv.buffer);
    view.setUint32(0, nsec);
    setInt64(view, 4, sec);
    return rv;
  }
}
function encodeDateToTimeSpec(date) {
  const msec = date.getTime();
  const sec = Math.floor(msec / 1e3);
  const nsec = (msec - sec * 1e3) * 1e6;
  const nsecInSec = Math.floor(nsec / 1e9);
  return {
    sec: sec + nsecInSec,
    nsec: nsec - nsecInSec * 1e9
  };
}
function encodeTimestampExtension(object) {
  if (object instanceof Date) {
    const timeSpec = encodeDateToTimeSpec(object);
    return encodeTimeSpecToTimestamp(timeSpec);
  } else {
    return null;
  }
}
function decodeTimestampToTimeSpec(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (data.byteLength) {
    case 4: {
      const sec = view.getUint32(0);
      const nsec = 0;
      return { sec, nsec };
    }
    case 8: {
      const nsec30AndSecHigh2 = view.getUint32(0);
      const secLow32 = view.getUint32(4);
      const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
      const nsec = nsec30AndSecHigh2 >>> 2;
      return { sec, nsec };
    }
    case 12: {
      const sec = getInt64(view, 4);
      const nsec = view.getUint32(0);
      return { sec, nsec };
    }
    default:
      throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
  }
}
function decodeTimestampExtension(data) {
  const timeSpec = decodeTimestampToTimeSpec(data);
  return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
}
const timestampExtension = {
  type: EXT_TIMESTAMP,
  encode: encodeTimestampExtension,
  decode: decodeTimestampExtension
};
const _ExtensionCodec = class _ExtensionCodec {
  constructor() {
    // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
    // this will make type errors a lot more clear
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __publicField(this, "__brand");
    // built-in extensions
    __publicField(this, "builtInEncoders", []);
    __publicField(this, "builtInDecoders", []);
    // custom extensions
    __publicField(this, "encoders", []);
    __publicField(this, "decoders", []);
    this.register(timestampExtension);
  }
  register({ type, encode: encode2, decode: decode2 }) {
    if (type >= 0) {
      this.encoders[type] = encode2;
      this.decoders[type] = decode2;
    } else {
      const index = -1 - type;
      this.builtInEncoders[index] = encode2;
      this.builtInDecoders[index] = decode2;
    }
  }
  tryToEncode(object, context) {
    for (let i = 0; i < this.builtInEncoders.length; i++) {
      const encodeExt = this.builtInEncoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = -1 - i;
          return new ExtData(type, data);
        }
      }
    }
    for (let i = 0; i < this.encoders.length; i++) {
      const encodeExt = this.encoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = i;
          return new ExtData(type, data);
        }
      }
    }
    if (object instanceof ExtData) {
      return object;
    }
    return null;
  }
  decode(data, type, context) {
    const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
    if (decodeExt) {
      return decodeExt(data, type, context);
    } else {
      return new ExtData(type, data);
    }
  }
};
__publicField(_ExtensionCodec, "defaultCodec", new _ExtensionCodec());
let ExtensionCodec = _ExtensionCodec;
function isArrayBufferLike(buffer) {
  return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}
function ensureUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (isArrayBufferLike(buffer)) {
    return new Uint8Array(buffer);
  } else {
    return Uint8Array.from(buffer);
  }
}
const DEFAULT_MAX_DEPTH = 100;
const DEFAULT_INITIAL_BUFFER_SIZE = 2048;
class Encoder {
  constructor(options) {
    __publicField(this, "extensionCodec");
    __publicField(this, "context");
    __publicField(this, "useBigInt64");
    __publicField(this, "maxDepth");
    __publicField(this, "initialBufferSize");
    __publicField(this, "sortKeys");
    __publicField(this, "forceFloat32");
    __publicField(this, "ignoreUndefined");
    __publicField(this, "forceIntegerToFloat");
    __publicField(this, "pos");
    __publicField(this, "view");
    __publicField(this, "bytes");
    __publicField(this, "entered", false);
    this.extensionCodec = (options == null ? void 0 : options.extensionCodec) ?? ExtensionCodec.defaultCodec;
    this.context = options == null ? void 0 : options.context;
    this.useBigInt64 = (options == null ? void 0 : options.useBigInt64) ?? false;
    this.maxDepth = (options == null ? void 0 : options.maxDepth) ?? DEFAULT_MAX_DEPTH;
    this.initialBufferSize = (options == null ? void 0 : options.initialBufferSize) ?? DEFAULT_INITIAL_BUFFER_SIZE;
    this.sortKeys = (options == null ? void 0 : options.sortKeys) ?? false;
    this.forceFloat32 = (options == null ? void 0 : options.forceFloat32) ?? false;
    this.ignoreUndefined = (options == null ? void 0 : options.ignoreUndefined) ?? false;
    this.forceIntegerToFloat = (options == null ? void 0 : options.forceIntegerToFloat) ?? false;
    this.pos = 0;
    this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
    this.bytes = new Uint8Array(this.view.buffer);
  }
  clone() {
    return new Encoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      maxDepth: this.maxDepth,
      initialBufferSize: this.initialBufferSize,
      sortKeys: this.sortKeys,
      forceFloat32: this.forceFloat32,
      ignoreUndefined: this.ignoreUndefined,
      forceIntegerToFloat: this.forceIntegerToFloat
    });
  }
  reinitializeState() {
    this.pos = 0;
  }
  /**
   * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
   *
   * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
   */
  encodeSharedRef(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encodeSharedRef(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.subarray(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  /**
   * @returns Encodes the object and returns a copy of the encoder's internal buffer.
   */
  encode(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encode(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.slice(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  doEncode(object, depth) {
    if (depth > this.maxDepth) {
      throw new Error(`Too deep objects in depth ${depth}`);
    }
    if (object == null) {
      this.encodeNil();
    } else if (typeof object === "boolean") {
      this.encodeBoolean(object);
    } else if (typeof object === "number") {
      if (!this.forceIntegerToFloat) {
        this.encodeNumber(object);
      } else {
        this.encodeNumberAsFloat(object);
      }
    } else if (typeof object === "string") {
      this.encodeString(object);
    } else if (this.useBigInt64 && typeof object === "bigint") {
      this.encodeBigInt64(object);
    } else {
      this.encodeObject(object, depth);
    }
  }
  ensureBufferSizeToWrite(sizeToWrite) {
    const requiredSize = this.pos + sizeToWrite;
    if (this.view.byteLength < requiredSize) {
      this.resizeBuffer(requiredSize * 2);
    }
  }
  resizeBuffer(newSize) {
    const newBuffer = new ArrayBuffer(newSize);
    const newBytes = new Uint8Array(newBuffer);
    const newView = new DataView(newBuffer);
    newBytes.set(this.bytes);
    this.view = newView;
    this.bytes = newBytes;
  }
  encodeNil() {
    this.writeU8(192);
  }
  encodeBoolean(object) {
    if (object === false) {
      this.writeU8(194);
    } else {
      this.writeU8(195);
    }
  }
  encodeNumber(object) {
    if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
      if (object >= 0) {
        if (object < 128) {
          this.writeU8(object);
        } else if (object < 256) {
          this.writeU8(204);
          this.writeU8(object);
        } else if (object < 65536) {
          this.writeU8(205);
          this.writeU16(object);
        } else if (object < 4294967296) {
          this.writeU8(206);
          this.writeU32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(207);
          this.writeU64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      } else {
        if (object >= -32) {
          this.writeU8(224 | object + 32);
        } else if (object >= -128) {
          this.writeU8(208);
          this.writeI8(object);
        } else if (object >= -32768) {
          this.writeU8(209);
          this.writeI16(object);
        } else if (object >= -2147483648) {
          this.writeU8(210);
          this.writeI32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(211);
          this.writeI64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      }
    } else {
      this.encodeNumberAsFloat(object);
    }
  }
  encodeNumberAsFloat(object) {
    if (this.forceFloat32) {
      this.writeU8(202);
      this.writeF32(object);
    } else {
      this.writeU8(203);
      this.writeF64(object);
    }
  }
  encodeBigInt64(object) {
    if (object >= BigInt(0)) {
      this.writeU8(207);
      this.writeBigUint64(object);
    } else {
      this.writeU8(211);
      this.writeBigInt64(object);
    }
  }
  writeStringHeader(byteLength) {
    if (byteLength < 32) {
      this.writeU8(160 + byteLength);
    } else if (byteLength < 256) {
      this.writeU8(217);
      this.writeU8(byteLength);
    } else if (byteLength < 65536) {
      this.writeU8(218);
      this.writeU16(byteLength);
    } else if (byteLength < 4294967296) {
      this.writeU8(219);
      this.writeU32(byteLength);
    } else {
      throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
    }
  }
  encodeString(object) {
    const maxHeaderSize = 1 + 4;
    const byteLength = utf8Count(object);
    this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
    this.writeStringHeader(byteLength);
    utf8Encode(object, this.bytes, this.pos);
    this.pos += byteLength;
  }
  encodeObject(object, depth) {
    const ext = this.extensionCodec.tryToEncode(object, this.context);
    if (ext != null) {
      this.encodeExtension(ext);
    } else if (Array.isArray(object)) {
      this.encodeArray(object, depth);
    } else if (ArrayBuffer.isView(object)) {
      this.encodeBinary(object);
    } else if (typeof object === "object") {
      this.encodeMap(object, depth);
    } else {
      throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
    }
  }
  encodeBinary(object) {
    const size = object.byteLength;
    if (size < 256) {
      this.writeU8(196);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(197);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(198);
      this.writeU32(size);
    } else {
      throw new Error(`Too large binary: ${size}`);
    }
    const bytes = ensureUint8Array(object);
    this.writeU8a(bytes);
  }
  encodeArray(object, depth) {
    const size = object.length;
    if (size < 16) {
      this.writeU8(144 + size);
    } else if (size < 65536) {
      this.writeU8(220);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(221);
      this.writeU32(size);
    } else {
      throw new Error(`Too large array: ${size}`);
    }
    for (const item of object) {
      this.doEncode(item, depth + 1);
    }
  }
  countWithoutUndefined(object, keys) {
    let count = 0;
    for (const key of keys) {
      if (object[key] !== void 0) {
        count++;
      }
    }
    return count;
  }
  encodeMap(object, depth) {
    const keys = Object.keys(object);
    if (this.sortKeys) {
      keys.sort();
    }
    const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
    if (size < 16) {
      this.writeU8(128 + size);
    } else if (size < 65536) {
      this.writeU8(222);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(223);
      this.writeU32(size);
    } else {
      throw new Error(`Too large map object: ${size}`);
    }
    for (const key of keys) {
      const value = object[key];
      if (!(this.ignoreUndefined && value === void 0)) {
        this.encodeString(key);
        this.doEncode(value, depth + 1);
      }
    }
  }
  encodeExtension(ext) {
    if (typeof ext.data === "function") {
      const data = ext.data(this.pos + 6);
      const size2 = data.length;
      if (size2 >= 4294967296) {
        throw new Error(`Too large extension object: ${size2}`);
      }
      this.writeU8(201);
      this.writeU32(size2);
      this.writeI8(ext.type);
      this.writeU8a(data);
      return;
    }
    const size = ext.data.length;
    if (size === 1) {
      this.writeU8(212);
    } else if (size === 2) {
      this.writeU8(213);
    } else if (size === 4) {
      this.writeU8(214);
    } else if (size === 8) {
      this.writeU8(215);
    } else if (size === 16) {
      this.writeU8(216);
    } else if (size < 256) {
      this.writeU8(199);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(200);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(201);
      this.writeU32(size);
    } else {
      throw new Error(`Too large extension object: ${size}`);
    }
    this.writeI8(ext.type);
    this.writeU8a(ext.data);
  }
  writeU8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setUint8(this.pos, value);
    this.pos++;
  }
  writeU8a(values) {
    const size = values.length;
    this.ensureBufferSizeToWrite(size);
    this.bytes.set(values, this.pos);
    this.pos += size;
  }
  writeI8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setInt8(this.pos, value);
    this.pos++;
  }
  writeU16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  writeI16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setInt16(this.pos, value);
    this.pos += 2;
  }
  writeU32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setUint32(this.pos, value);
    this.pos += 4;
  }
  writeI32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setInt32(this.pos, value);
    this.pos += 4;
  }
  writeF32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setFloat32(this.pos, value);
    this.pos += 4;
  }
  writeF64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setFloat64(this.pos, value);
    this.pos += 8;
  }
  writeU64(value) {
    this.ensureBufferSizeToWrite(8);
    setUint64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeI64(value) {
    this.ensureBufferSizeToWrite(8);
    setInt64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeBigUint64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigUint64(this.pos, value);
    this.pos += 8;
  }
  writeBigInt64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigInt64(this.pos, value);
    this.pos += 8;
  }
}
function encode(value, options) {
  const encoder = new Encoder(options);
  return encoder.encodeSharedRef(value);
}
function prettyByte(byte) {
  return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
}
const DEFAULT_MAX_KEY_LENGTH = 16;
const DEFAULT_MAX_LENGTH_PER_KEY = 16;
class CachedKeyDecoder {
  constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
    __publicField(this, "hit", 0);
    __publicField(this, "miss", 0);
    __publicField(this, "caches");
    __publicField(this, "maxKeyLength");
    __publicField(this, "maxLengthPerKey");
    this.maxKeyLength = maxKeyLength;
    this.maxLengthPerKey = maxLengthPerKey;
    this.caches = [];
    for (let i = 0; i < this.maxKeyLength; i++) {
      this.caches.push([]);
    }
  }
  canBeCached(byteLength) {
    return byteLength > 0 && byteLength <= this.maxKeyLength;
  }
  find(bytes, inputOffset, byteLength) {
    const records = this.caches[byteLength - 1];
    FIND_CHUNK: for (const record of records) {
      const recordBytes = record.bytes;
      for (let j = 0; j < byteLength; j++) {
        if (recordBytes[j] !== bytes[inputOffset + j]) {
          continue FIND_CHUNK;
        }
      }
      return record.str;
    }
    return null;
  }
  store(bytes, value) {
    const records = this.caches[bytes.length - 1];
    const record = { bytes, str: value };
    if (records.length >= this.maxLengthPerKey) {
      records[Math.random() * records.length | 0] = record;
    } else {
      records.push(record);
    }
  }
  decode(bytes, inputOffset, byteLength) {
    const cachedValue = this.find(bytes, inputOffset, byteLength);
    if (cachedValue != null) {
      this.hit++;
      return cachedValue;
    }
    this.miss++;
    const str = utf8DecodeJs(bytes, inputOffset, byteLength);
    const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
    this.store(slicedCopyOfBytes, str);
    return str;
  }
}
const STATE_ARRAY = "array";
const STATE_MAP_KEY = "map_key";
const STATE_MAP_VALUE = "map_value";
const mapKeyConverter = (key) => {
  if (typeof key === "string" || typeof key === "number") {
    return key;
  }
  throw new DecodeError("The type of key must be string or number but " + typeof key);
};
class StackPool {
  constructor() {
    __publicField(this, "stack", []);
    __publicField(this, "stackHeadPosition", -1);
  }
  get length() {
    return this.stackHeadPosition + 1;
  }
  top() {
    return this.stack[this.stackHeadPosition];
  }
  pushArrayState(size) {
    const state2 = this.getUninitializedStateFromPool();
    state2.type = STATE_ARRAY;
    state2.position = 0;
    state2.size = size;
    state2.array = new Array(size);
  }
  pushMapState(size) {
    const state2 = this.getUninitializedStateFromPool();
    state2.type = STATE_MAP_KEY;
    state2.readCount = 0;
    state2.size = size;
    state2.map = {};
  }
  getUninitializedStateFromPool() {
    this.stackHeadPosition++;
    if (this.stackHeadPosition === this.stack.length) {
      const partialState = {
        type: void 0,
        size: 0,
        array: void 0,
        position: 0,
        readCount: 0,
        map: void 0,
        key: null
      };
      this.stack.push(partialState);
    }
    return this.stack[this.stackHeadPosition];
  }
  release(state2) {
    const topStackState = this.stack[this.stackHeadPosition];
    if (topStackState !== state2) {
      throw new Error("Invalid stack state. Released state is not on top of the stack.");
    }
    if (state2.type === STATE_ARRAY) {
      const partialState = state2;
      partialState.size = 0;
      partialState.array = void 0;
      partialState.position = 0;
      partialState.type = void 0;
    }
    if (state2.type === STATE_MAP_KEY || state2.type === STATE_MAP_VALUE) {
      const partialState = state2;
      partialState.size = 0;
      partialState.map = void 0;
      partialState.readCount = 0;
      partialState.type = void 0;
    }
    this.stackHeadPosition--;
  }
  reset() {
    this.stack.length = 0;
    this.stackHeadPosition = -1;
  }
}
const HEAD_BYTE_REQUIRED = -1;
const EMPTY_VIEW = new DataView(new ArrayBuffer(0));
const EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
try {
  EMPTY_VIEW.getInt8(0);
} catch (e) {
  if (!(e instanceof RangeError)) {
    throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
  }
}
const MORE_DATA = new RangeError("Insufficient data");
const sharedCachedKeyDecoder = new CachedKeyDecoder();
class Decoder {
  constructor(options) {
    __publicField(this, "extensionCodec");
    __publicField(this, "context");
    __publicField(this, "useBigInt64");
    __publicField(this, "rawStrings");
    __publicField(this, "maxStrLength");
    __publicField(this, "maxBinLength");
    __publicField(this, "maxArrayLength");
    __publicField(this, "maxMapLength");
    __publicField(this, "maxExtLength");
    __publicField(this, "keyDecoder");
    __publicField(this, "mapKeyConverter");
    __publicField(this, "totalPos", 0);
    __publicField(this, "pos", 0);
    __publicField(this, "view", EMPTY_VIEW);
    __publicField(this, "bytes", EMPTY_BYTES);
    __publicField(this, "headByte", HEAD_BYTE_REQUIRED);
    __publicField(this, "stack", new StackPool());
    __publicField(this, "entered", false);
    this.extensionCodec = (options == null ? void 0 : options.extensionCodec) ?? ExtensionCodec.defaultCodec;
    this.context = options == null ? void 0 : options.context;
    this.useBigInt64 = (options == null ? void 0 : options.useBigInt64) ?? false;
    this.rawStrings = (options == null ? void 0 : options.rawStrings) ?? false;
    this.maxStrLength = (options == null ? void 0 : options.maxStrLength) ?? UINT32_MAX;
    this.maxBinLength = (options == null ? void 0 : options.maxBinLength) ?? UINT32_MAX;
    this.maxArrayLength = (options == null ? void 0 : options.maxArrayLength) ?? UINT32_MAX;
    this.maxMapLength = (options == null ? void 0 : options.maxMapLength) ?? UINT32_MAX;
    this.maxExtLength = (options == null ? void 0 : options.maxExtLength) ?? UINT32_MAX;
    this.keyDecoder = (options == null ? void 0 : options.keyDecoder) !== void 0 ? options.keyDecoder : sharedCachedKeyDecoder;
    this.mapKeyConverter = (options == null ? void 0 : options.mapKeyConverter) ?? mapKeyConverter;
  }
  clone() {
    return new Decoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      rawStrings: this.rawStrings,
      maxStrLength: this.maxStrLength,
      maxBinLength: this.maxBinLength,
      maxArrayLength: this.maxArrayLength,
      maxMapLength: this.maxMapLength,
      maxExtLength: this.maxExtLength,
      keyDecoder: this.keyDecoder
    });
  }
  reinitializeState() {
    this.totalPos = 0;
    this.headByte = HEAD_BYTE_REQUIRED;
    this.stack.reset();
  }
  setBuffer(buffer) {
    const bytes = ensureUint8Array(buffer);
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  appendBuffer(buffer) {
    if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
      this.setBuffer(buffer);
    } else {
      const remainingData = this.bytes.subarray(this.pos);
      const newData = ensureUint8Array(buffer);
      const newBuffer = new Uint8Array(remainingData.length + newData.length);
      newBuffer.set(remainingData);
      newBuffer.set(newData, remainingData.length);
      this.setBuffer(newBuffer);
    }
  }
  hasRemaining(size) {
    return this.view.byteLength - this.pos >= size;
  }
  createExtraByteError(posToShow) {
    const { view, pos } = this;
    return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
  }
  /**
   * @throws {@link DecodeError}
   * @throws {@link RangeError}
   */
  decode(buffer) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decode(buffer);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      const object = this.doDecodeSync();
      if (this.hasRemaining(1)) {
        throw this.createExtraByteError(this.pos);
      }
      return object;
    } finally {
      this.entered = false;
    }
  }
  *decodeMulti(buffer) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMulti(buffer);
      return;
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      while (this.hasRemaining(1)) {
        yield this.doDecodeSync();
      }
    } finally {
      this.entered = false;
    }
  }
  async decodeAsync(stream) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decodeAsync(stream);
    }
    try {
      this.entered = true;
      let decoded = false;
      let object;
      for await (const buffer of stream) {
        if (decoded) {
          this.entered = false;
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        try {
          object = this.doDecodeSync();
          decoded = true;
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
      if (decoded) {
        if (this.hasRemaining(1)) {
          throw this.createExtraByteError(this.totalPos);
        }
        return object;
      }
      const { headByte, pos, totalPos } = this;
      throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
    } finally {
      this.entered = false;
    }
  }
  decodeArrayStream(stream) {
    return this.decodeMultiAsync(stream, true);
  }
  decodeStream(stream) {
    return this.decodeMultiAsync(stream, false);
  }
  async *decodeMultiAsync(stream, isArray) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMultiAsync(stream, isArray);
      return;
    }
    try {
      this.entered = true;
      let isArrayHeaderRequired = isArray;
      let arrayItemsLeft = -1;
      for await (const buffer of stream) {
        if (isArray && arrayItemsLeft === 0) {
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        if (isArrayHeaderRequired) {
          arrayItemsLeft = this.readArraySize();
          isArrayHeaderRequired = false;
          this.complete();
        }
        try {
          while (true) {
            yield this.doDecodeSync();
            if (--arrayItemsLeft === 0) {
              break;
            }
          }
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
    } finally {
      this.entered = false;
    }
  }
  doDecodeSync() {
    DECODE: while (true) {
      const headByte = this.readHeadByte();
      let object;
      if (headByte >= 224) {
        object = headByte - 256;
      } else if (headByte < 192) {
        if (headByte < 128) {
          object = headByte;
        } else if (headByte < 144) {
          const size = headByte - 128;
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte < 160) {
          const size = headByte - 144;
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else {
          const byteLength = headByte - 160;
          object = this.decodeString(byteLength, 0);
        }
      } else if (headByte === 192) {
        object = null;
      } else if (headByte === 194) {
        object = false;
      } else if (headByte === 195) {
        object = true;
      } else if (headByte === 202) {
        object = this.readF32();
      } else if (headByte === 203) {
        object = this.readF64();
      } else if (headByte === 204) {
        object = this.readU8();
      } else if (headByte === 205) {
        object = this.readU16();
      } else if (headByte === 206) {
        object = this.readU32();
      } else if (headByte === 207) {
        if (this.useBigInt64) {
          object = this.readU64AsBigInt();
        } else {
          object = this.readU64();
        }
      } else if (headByte === 208) {
        object = this.readI8();
      } else if (headByte === 209) {
        object = this.readI16();
      } else if (headByte === 210) {
        object = this.readI32();
      } else if (headByte === 211) {
        if (this.useBigInt64) {
          object = this.readI64AsBigInt();
        } else {
          object = this.readI64();
        }
      } else if (headByte === 217) {
        const byteLength = this.lookU8();
        object = this.decodeString(byteLength, 1);
      } else if (headByte === 218) {
        const byteLength = this.lookU16();
        object = this.decodeString(byteLength, 2);
      } else if (headByte === 219) {
        const byteLength = this.lookU32();
        object = this.decodeString(byteLength, 4);
      } else if (headByte === 220) {
        const size = this.readU16();
        if (size !== 0) {
          this.pushArrayState(size);
          this.complete();
          continue DECODE;
        } else {
          object = [];
        }
      } else if (headByte === 221) {
        const size = this.readU32();
        if (size !== 0) {
          this.pushArrayState(size);
          this.complete();
          continue DECODE;
        } else {
          object = [];
        }
      } else if (headByte === 222) {
        const size = this.readU16();
        if (size !== 0) {
          this.pushMapState(size);
          this.complete();
          continue DECODE;
        } else {
          object = {};
        }
      } else if (headByte === 223) {
        const size = this.readU32();
        if (size !== 0) {
          this.pushMapState(size);
          this.complete();
          continue DECODE;
        } else {
          object = {};
        }
      } else if (headByte === 196) {
        const size = this.lookU8();
        object = this.decodeBinary(size, 1);
      } else if (headByte === 197) {
        const size = this.lookU16();
        object = this.decodeBinary(size, 2);
      } else if (headByte === 198) {
        const size = this.lookU32();
        object = this.decodeBinary(size, 4);
      } else if (headByte === 212) {
        object = this.decodeExtension(1, 0);
      } else if (headByte === 213) {
        object = this.decodeExtension(2, 0);
      } else if (headByte === 214) {
        object = this.decodeExtension(4, 0);
      } else if (headByte === 215) {
        object = this.decodeExtension(8, 0);
      } else if (headByte === 216) {
        object = this.decodeExtension(16, 0);
      } else if (headByte === 199) {
        const size = this.lookU8();
        object = this.decodeExtension(size, 1);
      } else if (headByte === 200) {
        const size = this.lookU16();
        object = this.decodeExtension(size, 2);
      } else if (headByte === 201) {
        const size = this.lookU32();
        object = this.decodeExtension(size, 4);
      } else {
        throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
      }
      this.complete();
      const stack2 = this.stack;
      while (stack2.length > 0) {
        const state2 = stack2.top();
        if (state2.type === STATE_ARRAY) {
          state2.array[state2.position] = object;
          state2.position++;
          if (state2.position === state2.size) {
            object = state2.array;
            stack2.release(state2);
          } else {
            continue DECODE;
          }
        } else if (state2.type === STATE_MAP_KEY) {
          if (object === "__proto__") {
            throw new DecodeError("The key __proto__ is not allowed");
          }
          state2.key = this.mapKeyConverter(object);
          state2.type = STATE_MAP_VALUE;
          continue DECODE;
        } else {
          state2.map[state2.key] = object;
          state2.readCount++;
          if (state2.readCount === state2.size) {
            object = state2.map;
            stack2.release(state2);
          } else {
            state2.key = null;
            state2.type = STATE_MAP_KEY;
            continue DECODE;
          }
        }
      }
      return object;
    }
  }
  readHeadByte() {
    if (this.headByte === HEAD_BYTE_REQUIRED) {
      this.headByte = this.readU8();
    }
    return this.headByte;
  }
  complete() {
    this.headByte = HEAD_BYTE_REQUIRED;
  }
  readArraySize() {
    const headByte = this.readHeadByte();
    switch (headByte) {
      case 220:
        return this.readU16();
      case 221:
        return this.readU32();
      default: {
        if (headByte < 160) {
          return headByte - 144;
        } else {
          throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
        }
      }
    }
  }
  pushMapState(size) {
    if (size > this.maxMapLength) {
      throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
    }
    this.stack.pushMapState(size);
  }
  pushArrayState(size) {
    if (size > this.maxArrayLength) {
      throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
    }
    this.stack.pushArrayState(size);
  }
  decodeString(byteLength, headerOffset) {
    if (!this.rawStrings || this.stateIsMapKey()) {
      return this.decodeUtf8String(byteLength, headerOffset);
    }
    return this.decodeBinary(byteLength, headerOffset);
  }
  /**
   * @throws {@link RangeError}
   */
  decodeUtf8String(byteLength, headerOffset) {
    var _a;
    if (byteLength > this.maxStrLength) {
      throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
    }
    if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
      throw MORE_DATA;
    }
    const offset = this.pos + headerOffset;
    let object;
    if (this.stateIsMapKey() && ((_a = this.keyDecoder) == null ? void 0 : _a.canBeCached(byteLength))) {
      object = this.keyDecoder.decode(this.bytes, offset, byteLength);
    } else {
      object = utf8Decode(this.bytes, offset, byteLength);
    }
    this.pos += headerOffset + byteLength;
    return object;
  }
  stateIsMapKey() {
    if (this.stack.length > 0) {
      const state2 = this.stack.top();
      return state2.type === STATE_MAP_KEY;
    }
    return false;
  }
  /**
   * @throws {@link RangeError}
   */
  decodeBinary(byteLength, headOffset) {
    if (byteLength > this.maxBinLength) {
      throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
    }
    if (!this.hasRemaining(byteLength + headOffset)) {
      throw MORE_DATA;
    }
    const offset = this.pos + headOffset;
    const object = this.bytes.subarray(offset, offset + byteLength);
    this.pos += headOffset + byteLength;
    return object;
  }
  decodeExtension(size, headOffset) {
    if (size > this.maxExtLength) {
      throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
    }
    const extType = this.view.getInt8(this.pos + headOffset);
    const data = this.decodeBinary(
      size,
      headOffset + 1
      /* extType */
    );
    return this.extensionCodec.decode(data, extType, this.context);
  }
  lookU8() {
    return this.view.getUint8(this.pos);
  }
  lookU16() {
    return this.view.getUint16(this.pos);
  }
  lookU32() {
    return this.view.getUint32(this.pos);
  }
  readU8() {
    const value = this.view.getUint8(this.pos);
    this.pos++;
    return value;
  }
  readI8() {
    const value = this.view.getInt8(this.pos);
    this.pos++;
    return value;
  }
  readU16() {
    const value = this.view.getUint16(this.pos);
    this.pos += 2;
    return value;
  }
  readI16() {
    const value = this.view.getInt16(this.pos);
    this.pos += 2;
    return value;
  }
  readU32() {
    const value = this.view.getUint32(this.pos);
    this.pos += 4;
    return value;
  }
  readI32() {
    const value = this.view.getInt32(this.pos);
    this.pos += 4;
    return value;
  }
  readU64() {
    const value = getUint64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readI64() {
    const value = getInt64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readU64AsBigInt() {
    const value = this.view.getBigUint64(this.pos);
    this.pos += 8;
    return value;
  }
  readI64AsBigInt() {
    const value = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return value;
  }
  readF32() {
    const value = this.view.getFloat32(this.pos);
    this.pos += 4;
    return value;
  }
  readF64() {
    const value = this.view.getFloat64(this.pos);
    this.pos += 8;
    return value;
  }
}
function decode(buffer, options) {
  const decoder = new Decoder(options);
  return decoder.decode(buffer);
}
function decodeMulti(buffer, options) {
  const decoder = new Decoder(options);
  return decoder.decodeMulti(buffer);
}
function isAsyncIterable(object) {
  return object[Symbol.asyncIterator] != null;
}
async function* asyncIterableFromStream(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
function ensureAsyncIterable(streamLike) {
  if (isAsyncIterable(streamLike)) {
    return streamLike;
  } else {
    return asyncIterableFromStream(streamLike);
  }
}
async function decodeAsync(streamLike, options) {
  const stream = ensureAsyncIterable(streamLike);
  const decoder = new Decoder(options);
  return decoder.decodeAsync(stream);
}
function decodeArrayStream(streamLike, options) {
  const stream = ensureAsyncIterable(streamLike);
  const decoder = new Decoder(options);
  return decoder.decodeArrayStream(stream);
}
function decodeMultiStream(streamLike, options) {
  const stream = ensureAsyncIterable(streamLike);
  const decoder = new Decoder(options);
  return decoder.decodeStream(stream);
}
const dist_esm = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  DecodeError,
  Decoder,
  EXT_TIMESTAMP,
  Encoder,
  ExtData,
  ExtensionCodec,
  decode,
  decodeArrayStream,
  decodeAsync,
  decodeMulti,
  decodeMultiStream,
  decodeTimestampExtension,
  decodeTimestampToTimeSpec,
  encode,
  encodeDateToTimeSpec,
  encodeTimeSpecToTimestamp,
  encodeTimestampExtension
}, Symbol.toStringTag, { value: "Module" }));
const require$$0 = /* @__PURE__ */ getAugmentedNamespace(dist_esm);
var machine$1 = {};
Object.defineProperty(machine$1, "__esModule", { value: true });
function valueEnumerable(value) {
  return { enumerable: true, value };
}
function valueEnumerableWritable(value) {
  return { enumerable: true, writable: true, value };
}
let d = {};
let truthy = () => true;
let empty = () => ({});
let identity = (a) => a;
let callBoth = (par, fn, self2, args) => par.apply(self2, args) && fn.apply(self2, args);
let callForward = (par, fn, self2, [a, b]) => fn.call(self2, par.call(self2, a, b), b);
let create = (a, b) => Object.freeze(Object.create(a, b));
function stack(fns, def, caller) {
  return fns.reduce((par, fn) => {
    return function(...args) {
      return caller(par, fn, this, args);
    };
  }, def);
}
function fnType(fn) {
  return create(this, { fn: valueEnumerable(fn) });
}
let reduceType = {};
let reduce = fnType.bind(reduceType);
let action = (fn) => reduce((ctx, ev) => !!~fn(ctx, ev) && ctx);
let guardType = {};
let guard = fnType.bind(guardType);
function filter(Type, arr) {
  return arr.filter((value) => Type.isPrototypeOf(value));
}
function makeTransition(from, to, ...args) {
  let guards = stack(filter(guardType, args).map((t) => t.fn), truthy, callBoth);
  let reducers = stack(filter(reduceType, args).map((t) => t.fn), identity, callForward);
  return create(this, {
    from: valueEnumerable(from),
    to: valueEnumerable(to),
    guards: valueEnumerable(guards),
    reducers: valueEnumerable(reducers)
  });
}
let transitionType = {};
let immediateType = {};
let transition = makeTransition.bind(transitionType);
let immediate = makeTransition.bind(immediateType, null);
function enterImmediate(machine2, service2, event) {
  return transitionTo(service2, machine2, event, this.immediates) || machine2;
}
function transitionsToMap(transitions) {
  let m = /* @__PURE__ */ new Map();
  for (let t of transitions) {
    if (!m.has(t.from)) m.set(t.from, []);
    m.get(t.from).push(t);
  }
  return m;
}
let stateType = { enter: identity };
function state(...args) {
  let transitions = filter(transitionType, args);
  let immediates = filter(immediateType, args);
  let desc = {
    final: valueEnumerable(args.length === 0),
    transitions: valueEnumerable(transitionsToMap(transitions))
  };
  if (immediates.length) {
    desc.immediates = valueEnumerable(immediates);
    desc.enter = valueEnumerable(enterImmediate);
  }
  return create(stateType, desc);
}
let invokeFnType = {
  enter(machine2, service2, event) {
    let rn = this.fn.call(service2, service2.context, event);
    if (machine.isPrototypeOf(rn))
      return create(invokeMachineType, {
        machine: valueEnumerable(rn),
        transitions: valueEnumerable(this.transitions)
      }).enter(machine2, service2, event);
    rn.then((data) => service2.send({ type: "done", data })).catch((error) => service2.send({ type: "error", error }));
    return machine2;
  }
};
let invokeMachineType = {
  enter(machine2, service2, event) {
    service2.child = interpret(this.machine, (s) => {
      service2.onChange(s);
      if (service2.child == s && s.machine.state.value.final) {
        delete service2.child;
        service2.send({ type: "done", data: s.context });
      }
    }, service2.context, event);
    if (service2.child.machine.state.value.final) {
      let data = service2.child.context;
      delete service2.child;
      return transitionTo(service2, machine2, { type: "done", data }, this.transitions.get("done"));
    }
    return machine2;
  }
};
function invoke(fn, ...transitions) {
  let t = valueEnumerable(transitionsToMap(transitions));
  return machine.isPrototypeOf(fn) ? create(invokeMachineType, {
    machine: valueEnumerable(fn),
    transitions: t
  }) : create(invokeFnType, {
    fn: valueEnumerable(fn),
    transitions: t
  });
}
let machine = {
  get state() {
    return {
      name: this.current,
      value: this.states[this.current]
    };
  }
};
function createMachine(current, states, contextFn = empty) {
  if (typeof current !== "string") {
    contextFn = states || empty;
    states = current;
    current = Object.keys(states)[0];
  }
  if (d._create) d._create(current, states);
  return create(machine, {
    context: valueEnumerable(contextFn),
    current: valueEnumerable(current),
    states: valueEnumerable(states)
  });
}
function transitionTo(service2, machine2, fromEvent, candidates) {
  let { context } = service2;
  for (let { to, guards, reducers } of candidates) {
    if (guards(context, fromEvent)) {
      service2.context = reducers.call(service2, context, fromEvent);
      let original = machine2.original || machine2;
      let newMachine = create(original, {
        current: valueEnumerable(to),
        original: { value: original }
      });
      if (d._onEnter) d._onEnter(machine2, to, service2.context, context, fromEvent);
      let state2 = newMachine.state.value;
      return state2.enter(newMachine, service2, fromEvent);
    }
  }
}
function send(service2, event) {
  let eventName = event.type || event;
  let { machine: machine2 } = service2;
  let { value: state2, name: currentStateName } = machine2.state;
  if (state2.transitions.has(eventName)) {
    return transitionTo(service2, machine2, event, state2.transitions.get(eventName)) || machine2;
  } else {
    if (d._send) d._send(eventName, currentStateName);
  }
  return machine2;
}
let service = {
  send(event) {
    this.machine = send(this, event);
    this.onChange(this);
  }
};
function interpret(machine2, onChange, initialContext, event) {
  let s = Object.create(service, {
    machine: valueEnumerableWritable(machine2),
    context: valueEnumerableWritable(machine2.context(initialContext, event)),
    onChange: valueEnumerable(onChange)
  });
  s.send = s.send.bind(s);
  s.machine = s.machine.state.value.enter(s.machine, s, event);
  return s;
}
machine$1.action = action;
machine$1.createMachine = createMachine;
machine$1.d = d;
machine$1.guard = guard;
machine$1.immediate = immediate;
machine$1.interpret = interpret;
machine$1.invoke = invoke;
machine$1.reduce = reduce;
machine$1.state = state;
machine$1.transition = transition;
var __awaiter$1 = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(realtime, "__esModule", { value: true });
realtime.createRealtimeClient = createRealtimeClient;
const msgpack_1 = require$$0;
const robot3_1 = machine$1;
const auth_1 = auth;
const response_1$1 = response;
const runtime_1 = runtime;
const utils_1 = utils;
const initialState = () => ({
  enqueuedMessage: void 0
});
function hasToken(context) {
  return context.token !== void 0;
}
function noToken(context) {
  return !hasToken(context);
}
function enqueueMessage(context, event) {
  return Object.assign(Object.assign({}, context), { enqueuedMessage: event.message });
}
function closeConnection(context) {
  if (context.websocket && context.websocket.readyState === WebSocket.OPEN) {
    context.websocket.close();
  }
  return Object.assign(Object.assign({}, context), { websocket: void 0 });
}
function sendMessage(context, event) {
  if (context.websocket && context.websocket.readyState === WebSocket.OPEN) {
    if (event.message instanceof Uint8Array) {
      context.websocket.send(event.message);
    } else if (typeof event.message === "string") {
      context.websocket.send(event.message);
    } else {
      context.websocket.send((0, msgpack_1.encode)(event.message));
    }
    return Object.assign(Object.assign({}, context), { enqueuedMessage: void 0 });
  }
  return Object.assign(Object.assign({}, context), { enqueuedMessage: event.message });
}
function expireToken(context) {
  return Object.assign(Object.assign({}, context), { token: void 0 });
}
function setToken(context, event) {
  return Object.assign(Object.assign({}, context), { token: event.token });
}
function connectionEstablished(context, event) {
  return Object.assign(Object.assign({}, context), { websocket: event.websocket });
}
const connectionStateMachine = (0, robot3_1.createMachine)("idle", {
  idle: (0, robot3_1.state)((0, robot3_1.transition)("send", "connecting", (0, robot3_1.reduce)(enqueueMessage)), (0, robot3_1.transition)("close", "idle", (0, robot3_1.reduce)(closeConnection))),
  connecting: (0, robot3_1.state)((0, robot3_1.transition)("connecting", "connecting"), (0, robot3_1.transition)("connected", "active", (0, robot3_1.reduce)(connectionEstablished)), (0, robot3_1.transition)("connectionClosed", "idle", (0, robot3_1.reduce)(closeConnection)), (0, robot3_1.transition)("send", "connecting", (0, robot3_1.reduce)(enqueueMessage)), (0, robot3_1.transition)("close", "idle", (0, robot3_1.reduce)(closeConnection)), (0, robot3_1.immediate)("authRequired", (0, robot3_1.guard)(noToken))),
  authRequired: (0, robot3_1.state)((0, robot3_1.transition)("initiateAuth", "authInProgress"), (0, robot3_1.transition)("send", "authRequired", (0, robot3_1.reduce)(enqueueMessage)), (0, robot3_1.transition)("close", "idle", (0, robot3_1.reduce)(closeConnection))),
  authInProgress: (0, robot3_1.state)((0, robot3_1.transition)("authenticated", "connecting", (0, robot3_1.reduce)(setToken)), (0, robot3_1.transition)("unauthorized", "idle", (0, robot3_1.reduce)(expireToken), (0, robot3_1.reduce)(closeConnection)), (0, robot3_1.transition)("send", "authInProgress", (0, robot3_1.reduce)(enqueueMessage)), (0, robot3_1.transition)("close", "idle", (0, robot3_1.reduce)(closeConnection))),
  active: (0, robot3_1.state)((0, robot3_1.transition)("send", "active", (0, robot3_1.reduce)(sendMessage)), (0, robot3_1.transition)("authenticated", "active", (0, robot3_1.reduce)(setToken)), (0, robot3_1.transition)("unauthorized", "idle", (0, robot3_1.reduce)(expireToken)), (0, robot3_1.transition)("connectionClosed", "idle", (0, robot3_1.reduce)(expireToken), (0, robot3_1.reduce)(closeConnection)), (0, robot3_1.transition)("close", "idle", (0, robot3_1.reduce)(expireToken), (0, robot3_1.reduce)(closeConnection)))
}, initialState);
function buildRealtimeUrl(app, { token, maxBuffering, path: path2 }) {
  var _a;
  if (maxBuffering !== void 0 && (maxBuffering < 1 || maxBuffering > 60)) {
    throw new Error("The `maxBuffering` must be between 1 and 60 (inclusive)");
  }
  const queryParams = new URLSearchParams({
    fal_jwt_token: token
  });
  if (maxBuffering !== void 0) {
    queryParams.set("max_buffering", maxBuffering.toFixed(0));
  }
  const appId = (0, utils_1.ensureEndpointIdFormat)(app);
  const resolvedPath = (_a = (0, utils_1.resolveEndpointPath)(app, path2, "/realtime")) !== null && _a !== void 0 ? _a : "";
  return `wss://fal.run/${appId}${resolvedPath}?${queryParams.toString()}`;
}
const DEFAULT_THROTTLE_INTERVAL = 128;
function isUnauthorizedError(message) {
  return message["status"] === "error" && message["error"] === "Unauthorized";
}
const WebSocketErrorCodes = {
  NORMAL_CLOSURE: 1e3
};
const connectionCache = /* @__PURE__ */ new Map();
const connectionCallbacks = /* @__PURE__ */ new Map();
function reuseInterpreter(key, throttleInterval, onChange) {
  if (!connectionCache.has(key)) {
    const service2 = (0, robot3_1.interpret)(connectionStateMachine, onChange);
    connectionCache.set(key, {
      service: service2,
      throttledSend: throttleInterval > 0 ? (0, utils_1.throttle)(service2.send, throttleInterval, true) : service2.send
    });
  }
  return connectionCache.get(key);
}
const noop = () => {
};
const NoOpConnection = {
  send: noop,
  close: noop
};
function isSuccessfulResult(data) {
  return data.status !== "error" && data.type !== "x-fal-message" && !isFalErrorResult(data);
}
function isFalErrorResult(data) {
  return data.type === "x-fal-error";
}
function decodeRealtimeMessage(data) {
  return __awaiter$1(this, void 0, void 0, function* () {
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    const toUint8Array = (value) => __awaiter$1(this, void 0, void 0, function* () {
      if (value instanceof Uint8Array) {
        return value;
      }
      if (value instanceof Blob) {
        return new Uint8Array(yield value.arrayBuffer());
      }
      return new Uint8Array(value);
    });
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return (0, msgpack_1.decode)(yield toUint8Array(data));
    }
    if (data instanceof Blob) {
      return (0, msgpack_1.decode)(yield toUint8Array(data));
    }
    return data;
  });
}
function encodeRealtimeMessage(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof input === "string") {
    return (0, msgpack_1.encode)(input);
  }
  return (0, msgpack_1.encode)(input);
}
function handleRealtimeMessage({ data, decodeMessage, onResult, onError, send: send2 }) {
  const handleDecoded = (decoded) => {
    if (isUnauthorizedError(decoded)) {
      send2({
        type: "unauthorized",
        error: new Error("Unauthorized")
      });
      return;
    }
    if (isSuccessfulResult(decoded)) {
      onResult(decoded);
      return;
    }
    if (isFalErrorResult(decoded)) {
      if (decoded.error === "TIMEOUT") {
        return;
      }
      onError(new response_1$1.ApiError({
        message: `${decoded.error}: ${decoded.reason}`,
        // TODO better error status code
        status: 400,
        body: decoded
      }));
      return;
    }
  };
  Promise.resolve(decodeMessage ? decodeMessage(data) : data).then(handleDecoded).catch((error) => {
    var _a;
    onError(new response_1$1.ApiError({
      message: (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : "Failed to decode realtime message",
      status: 400
    }));
  });
}
function createRealtimeClient({ config: config2 }) {
  return {
    connect(app, handler) {
      const {
        // if running on React in the server, set clientOnly to true by default
        clientOnly = (0, utils_1.isReact)() && !(0, runtime_1.isBrowser)(),
        connectionKey = crypto.randomUUID(),
        maxBuffering,
        path: path2,
        throttleInterval = DEFAULT_THROTTLE_INTERVAL,
        encodeMessage: encodeMessageOverride,
        decodeMessage: decodeMessageOverride,
        tokenProvider,
        tokenExpirationSeconds
      } = handler;
      if (clientOnly && !(0, runtime_1.isBrowser)()) {
        return NoOpConnection;
      }
      const encodeMessageFn = encodeMessageOverride !== null && encodeMessageOverride !== void 0 ? encodeMessageOverride : (input) => encodeRealtimeMessage(input);
      const decodeMessageFn = decodeMessageOverride !== null && decodeMessageOverride !== void 0 ? decodeMessageOverride : (data) => decodeRealtimeMessage(data);
      let previousState;
      let latestEnqueuedMessage;
      let tokenRefreshTimer;
      let tokenRefreshGeneration = 0;
      connectionCallbacks.set(connectionKey, {
        decodeMessage: decodeMessageFn,
        onError: handler.onError,
        onResult: handler.onResult
      });
      const getCallbacks = () => connectionCallbacks.get(connectionKey);
      const stateMachine = reuseInterpreter(connectionKey, throttleInterval, ({ context, machine: machine2, send: send3 }) => {
        var _a;
        const { enqueuedMessage, token, websocket } = context;
        latestEnqueuedMessage = enqueuedMessage;
        if (machine2.current === "active" && enqueuedMessage && (websocket === null || websocket === void 0 ? void 0 : websocket.readyState) === WebSocket.OPEN) {
          send3({ type: "send", message: enqueuedMessage });
        }
        if (machine2.current === "authRequired" && token === void 0 && previousState !== machine2.current) {
          send3({ type: "initiateAuth" });
          tokenRefreshGeneration++;
          const generation = tokenRefreshGeneration;
          const appId = (0, utils_1.ensureEndpointIdFormat)(app);
          const resolvedPath = (_a = (0, utils_1.resolveEndpointPath)(app, path2, "/realtime")) !== null && _a !== void 0 ? _a : "";
          const fetchToken = tokenProvider ? () => tokenProvider(`${appId}${resolvedPath}`) : () => {
            console.warn("[fal.realtime] Using the default token provider is deprecated. Please provide a `tokenProvider` function to `fal.realtime.connect()`. See https://docs.fal.ai/model-apis/client#client-side-usage-with-token-provider for more information.");
            return (0, auth_1.getTemporaryAuthToken)(app, config2);
          };
          const effectiveExpiration = tokenProvider ? tokenExpirationSeconds : auth_1.TOKEN_EXPIRATION_SECONDS;
          const scheduleTokenRefresh = effectiveExpiration !== void 0 ? () => {
            clearTimeout(tokenRefreshTimer);
            const refreshMs = Math.round(effectiveExpiration * 0.9 * 1e3);
            tokenRefreshTimer = setTimeout(() => {
              if (generation !== tokenRefreshGeneration) {
                return;
              }
              fetchToken().then((newToken) => {
                if (generation !== tokenRefreshGeneration) {
                  return;
                }
                queueMicrotask(() => {
                  send3({ type: "authenticated", token: newToken });
                });
                scheduleTokenRefresh();
              }).catch(() => {
                if (generation !== tokenRefreshGeneration) {
                  return;
                }
                const retryMs = Math.round(effectiveExpiration * 0.05 * 1e3);
                tokenRefreshTimer = setTimeout(() => {
                  scheduleTokenRefresh();
                }, retryMs);
              });
            }, refreshMs);
          } : noop;
          fetchToken().then((token2) => {
            queueMicrotask(() => {
              send3({ type: "authenticated", token: token2 });
            });
            scheduleTokenRefresh();
          }).catch((error) => {
            queueMicrotask(() => {
              send3({ type: "unauthorized", error });
            });
          });
        }
        if (machine2.current === "connecting" && previousState !== machine2.current && token !== void 0) {
          const ws = new WebSocket(buildRealtimeUrl(app, { token, maxBuffering, path: path2 }));
          ws.onopen = () => {
            var _a2, _b;
            send3({ type: "connected", websocket: ws });
            const queued = (_b = (_a2 = stateMachine.service.context) === null || _a2 === void 0 ? void 0 : _a2.enqueuedMessage) !== null && _b !== void 0 ? _b : latestEnqueuedMessage;
            if (queued) {
              ws.send(encodeMessageFn(queued));
              stateMachine.service.context = Object.assign(Object.assign({}, stateMachine.service.context), { enqueuedMessage: void 0 });
            }
          };
          ws.onclose = (event) => {
            if (event.code !== WebSocketErrorCodes.NORMAL_CLOSURE) {
              const { onError = noop } = getCallbacks();
              onError(new response_1$1.ApiError({
                message: `Error closing the connection: ${event.reason}`,
                status: event.code
              }));
            }
            send3({ type: "connectionClosed", code: event.code });
          };
          ws.onerror = (event) => {
            const { onError = noop } = getCallbacks();
            onError(new response_1$1.ApiError({ message: "Unknown error", status: 500 }));
          };
          ws.onmessage = (event) => {
            const { decodeMessage = decodeMessageFn, onResult, onError = noop } = getCallbacks();
            handleRealtimeMessage({
              data: event.data,
              decodeMessage,
              onResult,
              onError,
              send: send3
            });
          };
        }
        if (previousState === "active" && machine2.current !== "active") {
          clearTimeout(tokenRefreshTimer);
          tokenRefreshTimer = void 0;
        }
        previousState = machine2.current;
      });
      const send2 = (input) => {
        stateMachine.throttledSend({
          type: "send",
          message: encodeMessageFn(input)
        });
      };
      const close = () => {
        stateMachine.service.send({ type: "close" });
      };
      return {
        send: send2,
        close
      };
    }
  };
}
var __awaiter = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
Object.defineProperty(client, "__esModule", { value: true });
client.createFalClient = createFalClient;
const config_1 = config;
const headers_1 = headers;
const queue_1 = queue;
const realtime_1 = realtime;
const request_1 = request;
const response_1 = response;
const storage_1 = storage;
const streaming_1 = streaming;
function createFalClient(userConfig = {}) {
  const config2 = (0, config_1.createConfig)(userConfig);
  const storage2 = (0, storage_1.createStorageClient)({ config: config2 });
  const queue2 = (0, queue_1.createQueueClient)({ config: config2, storage: storage2 });
  const streaming2 = (0, streaming_1.createStreamingClient)({ config: config2, storage: storage2 });
  const realtime2 = (0, realtime_1.createRealtimeClient)({ config: config2 });
  return {
    queue: queue2,
    realtime: realtime2,
    storage: storage2,
    streaming: streaming2,
    stream: streaming2.stream,
    run(endpointId_1) {
      return __awaiter(this, arguments, void 0, function* (endpointId, options = {}) {
        const input = options.input ? yield storage2.transformInput(options.input) : void 0;
        return (0, request_1.dispatchRequest)({
          method: options.method,
          targetUrl: (0, request_1.buildUrl)(endpointId, options),
          input,
          // TODO: consider supporting custom headers in fal.run() as well
          headers: Object.assign(Object.assign({}, (0, storage_1.buildObjectLifecycleHeaders)(options.storageSettings)), (0, headers_1.buildTimeoutHeaders)(options.startTimeout)),
          config: Object.assign(Object.assign({}, config2), { responseHandler: response_1.resultResponseHandler }),
          options: {
            signal: options.abortSignal,
            retry: {
              maxRetries: 3,
              baseDelay: 500,
              maxDelay: 15e3
            }
          }
        });
      });
    },
    subscribe: (endpointId, options) => __awaiter(this, void 0, void 0, function* () {
      const { request_id: requestId } = yield queue2.submit(endpointId, options);
      if (options.onEnqueue) {
        options.onEnqueue(requestId);
      }
      yield queue2.subscribeToStatus(endpointId, Object.assign({ requestId }, options));
      return queue2.result(endpointId, { requestId });
    })
  };
}
var common = {};
Object.defineProperty(common, "__esModule", { value: true });
common.isQueueStatus = isQueueStatus;
common.isCompletedQueueStatus = isCompletedQueueStatus;
function isQueueStatus(obj) {
  return obj && obj.status && obj.response_url;
}
function isCompletedQueueStatus(obj) {
  return isQueueStatus(obj) && obj.status === "COMPLETED";
}
(function(exports) {
  var __createBinding = commonjsGlobal && commonjsGlobal.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() {
        return m[k];
      } };
    }
    Object.defineProperty(o, k2, desc);
  } : function(o, m, k, k2) {
    if (k2 === void 0) k2 = k;
    o[k2] = m[k];
  });
  var __exportStar = commonjsGlobal && commonjsGlobal.__exportStar || function(m, exports2) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.fal = exports.parseEndpointId = exports.isRetryableError = exports.ValidationError = exports.ApiError = exports.withProxy = exports.withMiddleware = exports.createFalClient = void 0;
  const client_1 = client;
  var client_2 = client;
  Object.defineProperty(exports, "createFalClient", { enumerable: true, get: function() {
    return client_2.createFalClient;
  } });
  var middleware_1 = middleware;
  Object.defineProperty(exports, "withMiddleware", { enumerable: true, get: function() {
    return middleware_1.withMiddleware;
  } });
  Object.defineProperty(exports, "withProxy", { enumerable: true, get: function() {
    return middleware_1.withProxy;
  } });
  var response_12 = response;
  Object.defineProperty(exports, "ApiError", { enumerable: true, get: function() {
    return response_12.ApiError;
  } });
  Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
    return response_12.ValidationError;
  } });
  var retry_12 = retry;
  Object.defineProperty(exports, "isRetryableError", { enumerable: true, get: function() {
    return retry_12.isRetryableError;
  } });
  __exportStar(common, exports);
  var utils_12 = utils;
  Object.defineProperty(exports, "parseEndpointId", { enumerable: true, get: function() {
    return utils_12.parseEndpointId;
  } });
  exports.fal = function createSingletonFalClient() {
    let currentInstance = (0, client_1.createFalClient)();
    return {
      config(config2) {
        currentInstance = (0, client_1.createFalClient)(config2);
      },
      get queue() {
        return currentInstance.queue;
      },
      get realtime() {
        return currentInstance.realtime;
      },
      get storage() {
        return currentInstance.storage;
      },
      get streaming() {
        return currentInstance.streaming;
      },
      run(id, options) {
        return currentInstance.run(id, options);
      },
      subscribe(endpointId, options) {
        return currentInstance.subscribe(endpointId, options);
      },
      stream(endpointId, options) {
        return currentInstance.stream(endpointId, options);
      }
    };
  }();
})(src);
let envLoaded = false;
function loadEnv(force = false) {
  if (envLoaded && !force) return;
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "cipher-studio", ".env"),
    path.join(electron.app.getAppPath(), ".env"),
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "../..", ".env")
  ];
  let loaded = false;
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[loadEnv] Cargando variables de entorno desde: ${envPath}`);
      try {
        const lines = fs.readFileSync(envPath, "utf8").split("\n");
        for (const line of lines) {
          const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2] ? match[2].trim() : "";
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
        loaded = true;
        break;
      } catch (err) {
        console.error(`[loadEnv] Error al leer el archivo ${envPath}: ${err.message}`);
      }
    }
  }
  if (!loaded) {
    console.warn(`[loadEnv] Advertencia: No se pudo encontrar ningún archivo .env en las rutas buscadas.`);
  }
  envLoaded = true;
}
async function exists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
loadEnv();
process.env.DIST = path.join(__dirname, "../..");
process.env.PUBLIC = electron.app.isPackaged ? path.join(process.env.DIST, "dist") : path.join(process.env.DIST, "public");
let win = null;
const preload = path.join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = path.join(process.env.DIST, "dist/index.html");
function createWindow() {
  win = new electron.BrowserWindow({
    title: "CIPHER Studio",
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    width: 1280,
    height: 800,
    backgroundColor: "#0f172a"
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  let isClosing = false;
  win.on("close", (e) => {
    if (!isClosing) {
      e.preventDefault();
      if (activeProjectPath) {
        cleanupProjectTemp(activeProjectPath);
      }
      win == null ? void 0 : win.webContents.send("save-before-close");
      isClosing = true;
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          win.destroy();
        }
      }, 4e3);
    }
  });
  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(indexHtml);
  }
}
function getBancoClipsPath() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "cipher-studio") {
    return path.join(cwd, "banco-clips");
  } else {
    return path.join(cwd, "cipher-studio", "banco-clips");
  }
}
async function writeDebugLog(message) {
  try {
    const cwd = process.cwd();
    let targetPath = "";
    if (path.basename(cwd) === "cipher-studio") {
      targetPath = path.join(cwd, "generation-debug.log");
    } else {
      targetPath = path.join(cwd, "cipher-studio", "generation-debug.log");
    }
    const dir = path.dirname(targetPath);
    if (!await exists(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    const time = (/* @__PURE__ */ new Date()).toISOString();
    await fs.promises.appendFile(targetPath, `[${time}] ${message}
`, "utf8");
  } catch (e) {
    console.error("Error writing to debug log:", e);
  }
}
async function initClipFolders() {
  const bankDir = getBancoClipsPath();
  const folders = [
    "",
    "originales",
    "stock",
    "veo3",
    "thumbnails"
  ];
  for (const f of folders) {
    const dirPath = path.join(bankDir, f);
    if (!await exists(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`[initClipFolders] Carpeta creada: ${dirPath}`);
    }
  }
}
electron.app.whenReady().then(async () => {
  await initClipFolders();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
electron.app.on("activate", () => {
  const allWindows = electron.BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
electron.ipcMain.on("start-transcription", async (event, filePath) => {
  const transcriptsDir = path.join(electron.app.getPath("userData"), "transcripts");
  if (!await exists(transcriptsDir)) {
    await fs.promises.mkdir(transcriptsDir, { recursive: true });
  }
  const basename = path.basename(filePath, path.extname(filePath));
  const expectedJsonPath = path.join(transcriptsDir, basename + ".json");
  if (await exists(expectedJsonPath)) {
    try {
      await fs.promises.unlink(expectedJsonPath);
    } catch (e) {
    }
  }
  if (!await exists(filePath)) {
    event.reply("transcription-update", {
      status: "error",
      error: `El archivo de audio no existe en la ruta: ${filePath}`
    });
    return;
  }
  event.reply("transcription-update", {
    status: "starting",
    message: "Conectando con Whisper local y cargando modelo..."
  });
  const whisperProcess = child_process.spawn("whisper", [
    `"${filePath}"`,
    "--language",
    "Spanish",
    "--model",
    "tiny",
    "--output_format",
    "json",
    "--output_dir",
    `"${transcriptsDir}"`
  ], { shell: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  let progressBuffer = "";
  whisperProcess.stdout.on("data", (data) => {
    const chunk = data.toString();
    progressBuffer += chunk;
    const lines = progressBuffer.split("\n");
    progressBuffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        event.reply("transcription-update", {
          status: "progress",
          message: trimmed
        });
      }
    }
  });
  whisperProcess.stderr.on("data", (data) => {
    const chunk = data.toString().trim();
    if (chunk) {
      event.reply("transcription-update", {
        status: "progress",
        message: chunk
      });
    }
  });
  whisperProcess.on("close", async (code) => {
    if (code === 0) {
      try {
        if (await exists(expectedJsonPath)) {
          const rawData = await fs.promises.readFile(expectedJsonPath, "utf8");
          const parsed = JSON.parse(rawData);
          event.reply("transcription-update", {
            status: "success",
            result: parsed
          });
          try {
            await fs.promises.unlink(expectedJsonPath);
          } catch (e) {
          }
        } else {
          event.reply("transcription-update", {
            status: "error",
            error: "No se generó el archivo de transcripción JSON esperado."
          });
        }
      } catch (err) {
        event.reply("transcription-update", {
          status: "error",
          error: `Error al procesar el archivo de salida de Whisper: ${err.message}`
        });
      }
    } else {
      event.reply("transcription-update", {
        status: "error",
        error: `Whisper falló con código de salida ${code}`
      });
    }
  });
});
let activeProjectPath = null;
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}
async function getProjectsDir() {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (path.basename(cwd) !== "cipher-studio") {
    baseDir = path.join(cwd, "cipher-studio");
  }
  const dir = path.join(baseDir, "proyectos");
  if (!await exists(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  return dir;
}
async function cleanupProjectTemp(projectPath) {
  const tempPath = path.join(projectPath, "temp");
  if (await exists(tempPath)) {
    try {
      await fs.promises.rm(tempPath, { recursive: true, force: true });
      console.log(`[cleanupProjectTemp] Temporales eliminados en: ${tempPath}`);
    } catch (e) {
      console.error(`[cleanupProjectTemp] Error al eliminar temporales:`, e);
    }
  }
}
async function initProjectDirs(projectPath) {
  const folders = [
    "voices",
    "temp",
    "temp/originales",
    "temp/remotion",
    "temp/hyperframes",
    "temp/minimax",
    "temp/stock",
    "temp/thumbnails"
  ];
  for (const f of folders) {
    const dir = path.join(projectPath, f);
    if (!await exists(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
}
async function sanitizeProjectState(parsed) {
  return parsed;
}
electron.ipcMain.handle("list-projects", async () => {
  try {
    const projectsDir = await getProjectsDir();
    const items = await fs.promises.readdir(projectsDir);
    const projectsList = [];
    for (const item of items) {
      const projectPath = path.join(projectsDir, item);
      const stat = await fs.promises.stat(projectPath);
      if (stat.isDirectory()) {
        const stateFile = path.join(projectPath, "project-state.json");
        if (await exists(stateFile)) {
          try {
            const raw = await fs.promises.readFile(stateFile, "utf8");
            const data = JSON.parse(raw);
            projectsList.push({
              id: data.id || item,
              name: data.name || item,
              durationSeconds: data.durationSeconds || 0,
              date: data.date || stat.mtimeMs,
              projectPath,
              thumbnailUrl: data.thumbnailUrl || ""
            });
          } catch (e) {
            console.error(`Error al leer project-state.json en ${item}:`, e);
          }
        }
      }
    }
    projectsList.sort((a, b) => b.date - a.date);
    return { success: true, projects: projectsList };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("create-project", async (_event, { name: name2 }) => {
  try {
    const projectsDir = await getProjectsDir();
    const id = `${slugify(name2 || "Nuevo Proyecto")}-${Date.now()}`;
    const projectPath = path.join(projectsDir, id);
    if (activeProjectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    await initProjectDirs(projectPath);
    const initialState2 = {
      id,
      name: name2,
      date: Date.now(),
      durationSeconds: 0,
      clips: [],
      timelineVideoClips: [],
      transcriptionStatus: "",
      transcriptSegments: [],
      aiScript: "",
      originalTranscriptText: "",
      voiceModel: "Eleven English v1",
      voiceSpeaker: "Rachel",
      voiceSpeed: 1,
      voiceStability: 50,
      generatedVoices: [],
      timelineWeights: [40, 30, 20, 10]
    };
    const stateFile = path.join(projectPath, "project-state.json");
    await fs.promises.writeFile(stateFile, JSON.stringify(initialState2, null, 2), "utf8");
    activeProjectPath = projectPath;
    console.log(`[create-project] Proyecto creado en: ${projectPath}`);
    return { success: true, data: initialState2, projectPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("load-project", async (_event, { projectPath }) => {
  try {
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    const stateFile = path.join(projectPath, "project-state.json");
    if (!await exists(stateFile)) {
      return { success: false, error: "No se encontró el estado del proyecto en la carpeta seleccionada." };
    }
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath);
    const raw = await fs.promises.readFile(stateFile, "utf8");
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    activeProjectPath = projectPath;
    console.log(`[load-project] Proyecto cargado desde: ${projectPath}`);
    return { success: true, data: parsed, projectPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("close-project", async () => {
  try {
    if (activeProjectPath) {
      await cleanupProjectTemp(activeProjectPath);
      console.log(`[close-project] Proyecto cerrado y temporales limpiados: ${activeProjectPath}`);
      activeProjectPath = null;
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-project", async (_event, { projectPath }) => {
  try {
    if (activeProjectPath === projectPath) {
      activeProjectPath = null;
    }
    if (await exists(projectPath)) {
      await fs.promises.rm(projectPath, { recursive: true, force: true });
      console.log(`[delete-project] Carpeta de proyecto eliminada: ${projectPath}`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-all-projects", async () => {
  try {
    const projectsDir = await getProjectsDir();
    const items = await fs.promises.readdir(projectsDir);
    for (const item of items) {
      const projectPath = path.join(projectsDir, item);
      const stat = await fs.promises.stat(projectPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(projectPath, { recursive: true, force: true });
      }
    }
    activeProjectPath = null;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("clear-global-stock-cache", async () => {
  try {
    const stockDir = path.join(getBancoClipsPath(), "stock");
    if (await exists(stockDir)) {
      await fs.promises.rm(stockDir, { recursive: true, force: true });
      await fs.promises.mkdir(stockDir, { recursive: true });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("save-project-state", async (_event, state2) => {
  try {
    const targetPath = activeProjectPath || process.cwd();
    const filePath = path.join(targetPath, "project-state.json");
    const sanitized = await sanitizeProjectState(state2);
    sanitized.date = Date.now();
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("load-project-state", async () => {
  try {
    if (activeProjectPath) {
      const stateFile = path.join(activeProjectPath, "project-state.json");
      if (await exists(stateFile)) {
        const raw = await fs.promises.readFile(stateFile, "utf8");
        const parsed = await sanitizeProjectState(JSON.parse(raw));
        return { success: true, data: parsed };
      }
    }
    const filePath = path.join(process.cwd(), "project-state.json");
    if (await exists(filePath)) {
      const rawData = await fs.promises.readFile(filePath, "utf8");
      const parsed = await sanitizeProjectState(JSON.parse(rawData));
      return { success: true, data: parsed };
    }
    return { success: false, error: "No se encontró proyecto activo." };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.on("ready-to-close", () => {
  if (win && !win.isDestroyed()) {
    win.destroy();
  }
});
electron.ipcMain.handle("save-project-as", async (_event, state2) => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const { filePath, canceled } = await electron.dialog.showSaveDialog(win, {
      title: "Guardar Proyecto Como",
      defaultPath: activeProjectPath ? path.join(activeProjectPath, "project-state.json") : path.join(process.cwd(), "project-state.json"),
      filters: [{ name: "JSON Project", extensions: ["json"] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Guardado cancelado por el usuario" };
    }
    const sanitized = await sanitizeProjectState(state2);
    sanitized.date = Date.now();
    await fs.promises.writeFile(filePath, JSON.stringify(sanitized, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("open-project", async () => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const { filePaths, canceled } = await electron.dialog.showOpenDialog(win, {
      title: "Abrir Proyecto",
      defaultPath: await getProjectsDir(),
      filters: [{ name: "JSON Project", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, error: "Carga cancelada" };
    }
    const filePath = filePaths[0];
    const projectPath = path.dirname(filePath);
    if (activeProjectPath && activeProjectPath !== projectPath) {
      await cleanupProjectTemp(activeProjectPath);
    }
    await initProjectDirs(projectPath);
    await cleanupProjectTemp(projectPath);
    await initProjectDirs(projectPath);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = await sanitizeProjectState(JSON.parse(raw));
    activeProjectPath = projectPath;
    return { success: true, data: parsed, projectPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
function cleanMarkdown(text) {
  if (!text) return "";
  const lines = text.split("\n");
  const cleanedLines = [];
  const sectionKeywords = [
    "gancho",
    "enigma",
    "desarrollo",
    "aterrizaje",
    "cierre",
    "título",
    "titulo",
    "guión",
    "guion",
    "script",
    "sección",
    "seccion",
    "introducción",
    "introduccion",
    "conclusión",
    "conclusion",
    "escena",
    "paso",
    "bloque",
    "parte",
    "fase"
  ];
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed.startsWith("aquí tienes") || lowerTrimmed.startsWith("aqui tienes") || lowerTrimmed.startsWith("este guion") || lowerTrimmed.startsWith("este guió") || lowerTrimmed.startsWith("he reescrito") || lowerTrimmed.startsWith("explicación del estilo") || lowerTrimmed.startsWith("explicacion del estilo") || lowerTrimmed.startsWith("estilo utilizado") || lowerTrimmed.startsWith("espero que") || lowerTrimmed.startsWith("nota:") || lowerTrimmed.startsWith("importante:")) {
      continue;
    }
    if (trimmed.startsWith("#")) {
      const headingText = trimmed.replace(/^#+\s*/, "").trim();
      const lowerHeading = headingText.toLowerCase();
      const isStructural = sectionKeywords.some((keyword) => lowerHeading.includes(keyword)) || headingText.length < 25;
      if (isStructural) {
        continue;
      }
      trimmed = headingText;
    }
    trimmed = trimmed.replace(/^[-*+]\s+/, "");
    trimmed = trimmed.replace(/^\d+\.\s+/, "");
    trimmed = trimmed.replace(/^\*+([^*:]+)\*+:\s*/, "");
    trimmed = trimmed.replace(/\*\*|__|\*|_/g, "");
    trimmed = trimmed.replace(/\[[^\]]+\]/g, "");
    trimmed = trimmed.replace(/\([^)]+\)/g, "");
    trimmed = trimmed.replace(/\s+/g, " ").trim();
    if (trimmed.length > 0) {
      cleanedLines.push(trimmed);
    }
  }
  return cleanedLines.join("\n\n");
}
electron.ipcMain.handle("rewrite-transcript", async (_event, text) => {
  var _a, _b, _c;
  try {
    let promptPath = path.join(process.cwd(), "src/prompt-maestro.txt");
    if (!await exists(promptPath)) {
      const possiblePaths = [
        path.join(electron.app.getAppPath(), "src/prompt-maestro.txt"),
        path.join(__dirname, "../../src/prompt-maestro.txt"),
        path.join(__dirname, "../prompt-maestro.txt"),
        path.join(process.cwd(), "prompt-maestro.txt")
      ];
      for (const p of possiblePaths) {
        if (await exists(p)) {
          promptPath = p;
          break;
        }
      }
    }
    if (!await exists(promptPath)) {
      return { success: false, error: "No se encontró el archivo prompt-maestro.txt en cipher-studio/src" };
    }
    const promptTemplate = await fs.promises.readFile(promptPath, "utf8");
    const finalPrompt = promptTemplate.replace("[TRANSCRIPCIÓN]", text);
    loadEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    }
    const response2 = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Eres un guionista experto. Tu única tarea es reescribir la transcripción siguiendo el estilo solicitado. IMPORTANTE: Entrega ÚNICAMENTE el texto corrido del guion final resultante que será hablado de forma continua frente a la cámara. Está estrictamente PROHIBIDO incluir títulos, encabezados, viñetas, formato markdown, saludos, introducciones, notas o comentarios adicionales. Empieza a responder directamente con el primer párrafo del guion."
          },
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });
    if (!response2.ok) {
      const errText = await response2.text();
      return { success: false, error: `Error de API DeepSeek (${response2.status}): ${errText}` };
    }
    const data = await response2.json();
    const content = (_c = (_b = (_a = data == null ? void 0 : data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content;
    if (!content) {
      return { success: false, error: "La respuesta de DeepSeek no contiene contenido válido." };
    }
    const cleanContent = cleanMarkdown(content);
    return { success: true, data: cleanContent };
  } catch (err) {
    return { success: false, error: err.message || "Error desconocido al reescribir con DeepSeek" };
  }
});
electron.ipcMain.handle("get-elevenlabs-voices", async () => {
  try {
    loadEnv();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false, error: "ELEVENLABS_API_KEY no está configurado en el archivo .env." };
    }
    console.log("[get-elevenlabs-voices] Solicitando voces a ElevenLabs...");
    const response2 = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "accept": "application/json"
      }
    });
    if (!response2.ok) {
      const errText = await response2.text();
      return { success: false, error: `Error de ElevenLabs API (${response2.status}): ${errText}` };
    }
    const data = await response2.json();
    let voices = data.voices || [];
    const myVoiceId = "c9cmyX6CFsCvEKNVoCZ1";
    const myVoiceIndex = voices.findIndex((v) => v.voice_id === myVoiceId);
    if (myVoiceIndex !== -1) {
      const myVoice = voices[myVoiceIndex];
      myVoice.is_my_voice = true;
      myVoice.name = `${myVoice.name} (Mi voz)`;
      voices.splice(myVoiceIndex, 1);
      voices.unshift(myVoice);
    } else {
      voices.unshift({
        voice_id: myVoiceId,
        name: "Clon de mi Voz (Mi voz)",
        preview_url: "",
        category: "cloned",
        is_my_voice: true
      });
    }
    return { success: true, voices };
  } catch (err) {
    console.error("[get-elevenlabs-voices] Error:", err);
    return { success: false, error: err.message || "Error al conectar con la API de ElevenLabs." };
  }
});
electron.ipcMain.handle("generate-voice", async (_event, { text, model, voiceId, stability }) => {
  try {
    loadEnv();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      const errMessage = "Error: ELEVENLABS_API_KEY no está configurado en el archivo .env o no pudo ser leído.";
      console.error(`[generate-voice] ${errMessage}`);
      return { success: false, error: errMessage };
    }
    const targetVoiceId = voiceId || "c9cmyX6CFsCvEKNVoCZ1";
    let modelId = "eleven_multilingual_v2";
    if (model === "Eleven English v1") {
      modelId = "eleven_monolingual_v1";
    } else if (model === "Eleven Turbo v2") {
      modelId = "eleven_turbo_v2";
    }
    const cleanStability = typeof stability === "number" ? stability / 100 : 0.5;
    console.log(`[generate-voice] Iniciando proceso de generación de voz:`);
    console.log(`  - Texto a procesar: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}" (longitud: ${text.length} caracteres)`);
    console.log(`  - Modelo seleccionado: "${model}" => API Model ID: "${modelId}"`);
    console.log(`  - Voice ID seleccionado: "${targetVoiceId}"`);
    console.log(`  - Estabilidad: ${stability}% (procesada: ${cleanStability})`);
    const maskedKey = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 6);
    console.log(`  - API Key de ElevenLabs: ${maskedKey} (longitud: ${apiKey.length} caracteres)`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[generate-voice] Solicitud abortada: Superó el tiempo de espera de 40 segundos.`);
      controller.abort();
    }, 4e4);
    try {
      console.log(`[generate-voice] Enviando solicitud POST a https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}...`);
      const response2 = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: cleanStability,
            similarity_boost: 0.75
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log(`[generate-voice] Respuesta recibida de ElevenLabs. Status: ${response2.status} (${response2.statusText})`);
      if (!response2.ok) {
        const errText = await response2.text();
        const errMessage = `Error de API ElevenLabs (${response2.status}): ${errText}`;
        console.error(`[generate-voice] La API retornó un error: ${errMessage}`);
        return { success: false, error: errMessage };
      }
      const arrayBuffer = await response2.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[generate-voice] Buffer de audio recibido. Tamaño: ${buffer.byteLength} bytes`);
      const voicesDir = activeProjectPath ? path.join(activeProjectPath, "voices") : path.join(electron.app.getPath("userData"), "generated-voices");
      if (!await exists(voicesDir)) {
        await fs.promises.mkdir(voicesDir, { recursive: true });
      }
      const filename = `voice-${Date.now()}.mp3`;
      const filePath = path.join(voicesDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      console.log(`[generate-voice] Archivo de voz guardado localmente en: ${filePath}`);
      const durationSeconds = await getVideoDuration(filePath);
      const base64Audio = buffer.toString("base64");
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      console.log(`[generate-voice] Transcribiendo el audio generado con Whisper (hasta 3 intentos)...`);
      const transcriptsDir = path.join(electron.app.getPath("userData"), "transcripts");
      if (!await exists(transcriptsDir)) {
        await fs.promises.mkdir(transcriptsDir, { recursive: true });
      }
      const basename = path.basename(filePath, path.extname(filePath));
      const expectedJsonPath = path.join(transcriptsDir, basename + ".json");
      let newAudioSegments = [];
      let whisperSuccess = false;
      let whisperErrorMsg = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[generate-voice] Intento de transcripción ${attempt}/3...`);
          if (await exists(expectedJsonPath)) {
            try {
              await fs.promises.unlink(expectedJsonPath);
            } catch (e) {
            }
          }
          await new Promise((resolve, reject) => {
            const whisperProcess = child_process.spawn("whisper", [
              `"${filePath}"`,
              "--language",
              "Spanish",
              "--model",
              "tiny",
              "--output_format",
              "json",
              "--output_dir",
              `"${transcriptsDir}"`
            ], { shell: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
            whisperProcess.on("close", async (code) => {
              if (code === 0) {
                try {
                  if (await exists(expectedJsonPath)) {
                    const rawData = await fs.promises.readFile(expectedJsonPath, "utf8");
                    const parsed = JSON.parse(rawData);
                    if (parsed && Array.isArray(parsed.segments)) {
                      newAudioSegments = parsed.segments.map((seg) => ({
                        start: seg.start,
                        end: seg.end,
                        text: seg.text
                      }));
                      whisperSuccess = true;
                    } else {
                      throw new Error("La respuesta de Whisper no contiene la lista de segmentos esperada.");
                    }
                    try {
                      await fs.promises.unlink(expectedJsonPath);
                    } catch (e) {
                    }
                    resolve();
                  } else {
                    reject(new Error("No se generó el archivo de transcripción JSON esperado de Whisper."));
                  }
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error(`Whisper falló con código de salida ${code}`));
              }
            });
          });
          if (whisperSuccess) {
            console.log(`[generate-voice] Transcripción Whisper exitosa en el intento ${attempt}.`);
            break;
          }
        } catch (err) {
          whisperErrorMsg = err.message || "Error desconocido";
          console.error(`[generate-voice] Intento ${attempt} fallido: ${whisperErrorMsg}`);
          if (attempt < 3) {
            console.log(`[generate-voice] Esperando 2 segundos antes del siguiente intento...`);
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          }
        }
      }
      if (!whisperSuccess) {
        const fullErrMsg = `No se pudo transcribir el audio. Verifica que Whisper esté instalado correctamente. (Detalle: ${whisperErrorMsg})`;
        console.error(`[generate-voice] ${fullErrMsg}`);
        return { success: false, error: fullErrMsg };
      }
      return { success: true, filePath, audioUrl, durationSeconds, newAudioSegments };
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      let fetchErrMsg = fetchErr.message || "Error de conexión";
      if (fetchErr.name === "AbortError") {
        fetchErrMsg = "La conexión con ElevenLabs excedió el tiempo límite de espera de 40 segundos.";
      }
      console.error(`[generate-voice] Excepción durante el fetch: ${fetchErrMsg}`, fetchErr);
      return { success: false, error: `Error de red/conexión: ${fetchErrMsg}` };
    }
  } catch (err) {
    const errMessage = err.message || "Error desconocido en ElevenLabs TTS";
    console.error(`[generate-voice] Excepción general: ${errMessage}`, err);
    return { success: false, error: errMessage };
  }
});
electron.ipcMain.handle("generate-minimax-video", async (_event, { prompt }) => {
  var _a, _b, _c;
  try {
    loadEnv(true);
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return { success: false, error: "FAL_KEY no está configurado en el archivo .env." };
    }
    console.log("[generate-minimax-video] Iniciando generación en fal.ai con prompt:", prompt);
    process.env.FAL_KEY = apiKey;
    const result = await src.fal.subscribe("fal-ai/minimax/video-01", {
      input: {
        prompt
      }
    });
    const downloadUrl = ((_a = result == null ? void 0 : result.video) == null ? void 0 : _a.url) || ((_c = (_b = result == null ? void 0 : result.data) == null ? void 0 : _b.video) == null ? void 0 : _c.url);
    if (!downloadUrl) {
      return { success: false, error: `fal.ai no devolvió una URL de video: ${JSON.stringify(result)}` };
    }
    console.log(`[generate-minimax-video] Descargando video desde fal.ai: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      return { success: false, error: `Error al descargar el archivo de video: ${downloadRes.statusText}` };
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const targetDir = activeProjectPath ? path.join(activeProjectPath, "temp", "minimax") : path.join(process.cwd(), "cipher-studio", "banco-clips", "minimax");
    if (!await exists(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    const filename = `minimax-${Date.now()}.mp4`;
    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    const durationSeconds = await getVideoDuration(filePath);
    const thumbFilename = `thumb-${path.basename(filename, ".mp4")}.jpg`;
    const thumbDir = activeProjectPath ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(process.cwd(), "cipher-studio", "banco-clips", "thumbnails");
    if (!await exists(thumbDir)) {
      await fs.promises.mkdir(thumbDir, { recursive: true });
    }
    const thumbPath = path.join(thumbDir, thumbFilename);
    let thumbnailUrl = "";
    try {
      await generateVideoThumbnail(filePath, thumbPath);
      thumbnailUrl = `file:///${thumbPath.replace(/\\/g, "/")}`;
    } catch (e) {
      console.error("[generate-minimax-video] Error generating thumbnail:", e);
    }
    return {
      success: true,
      filePath,
      durationSeconds,
      thumbnailUrl,
      name: filename
    };
  } catch (err) {
    console.error("[generate-minimax-video] Excepción:", err);
    return { success: false, error: err.message || "Error desconocido al generar video con fal.ai/MiniMax." };
  }
});
electron.ipcMain.handle("load-bank-clips", async (_event, { category }) => {
  try {
    const isTempCategory = ["originales", "minimax", "stock"].includes(category.toLowerCase());
    const useActiveProj = !!(activeProjectPath && isTempCategory);
    const baseDir = useActiveProj ? activeProjectPath : getBancoClipsPath();
    const dirPath = useActiveProj ? path.join(baseDir, "temp", category) : path.join(baseDir, category);
    const thumbnailDir = useActiveProj ? path.join(baseDir, "temp", "thumbnails") : path.join(baseDir, "thumbnails");
    if (!await exists(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    if (!await exists(thumbnailDir)) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
    }
    const files = await fs.promises.readdir(dirPath);
    const bankClips = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile() && /\.(mp4|mkv|avi|mov|webm)$/i.test(file)) {
        const durationSeconds = await getVideoDuration(filePath);
        const durationStr = formatTimeMinutesSeconds(durationSeconds);
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailName);
        let thumbnailUrl = "";
        if (await exists(thumbnailPath)) {
          try {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
          } catch (e) {
            console.error(`[load-bank-clips] Error al leer miniatura para ${file}:`, e);
          }
        } else {
          try {
            await generateVideoThumbnail(filePath, thumbnailPath);
            if (await exists(thumbnailPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
            }
          } catch (e) {
            console.error(`[load-bank-clips] Error al generar miniatura para ${file}:`, e);
          }
        }
        bankClips.push({
          id: `bank-${category}-${file}`,
          name: file,
          path: filePath,
          url: `file:///${filePath.replace(/\\/g, "/")}`,
          duration: durationStr,
          durationSeconds,
          type: "video",
          size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          thumbnailUrl
        });
      }
    }
    return { success: true, clips: bankClips };
  } catch (err) {
    console.error(`[load-bank-clips] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("cut-video-clips", async (_event, { videoPath, timestamps }) => {
  try {
    console.log(`[cut-video-clips] Slicing video: ${videoPath}, timestamps length: ${(timestamps == null ? void 0 : timestamps.length) || 0}`);
    const bankDir = getBancoClipsPath();
    const useActiveProj = !!activeProjectPath;
    const outDir = useActiveProj ? path.join(activeProjectPath, "temp", "originales") : path.join(bankDir, "originales");
    const thumbnailDir = useActiveProj ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(bankDir, "thumbnails");
    if (!await exists(outDir)) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }
    if (!await exists(thumbnailDir)) {
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
    }
    const existingFiles = await fs.promises.readdir(outDir);
    for (const file of existingFiles) {
      try {
        await fs.promises.unlink(path.join(outDir, file));
      } catch (e) {
      }
    }
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const clipNum = String(i + 1).padStart(3, "0");
        const clipFileName = `clip_${clipNum}.mp4`;
        const clipPath = path.join(outDir, clipFileName);
        const escapedClipPath = clipPath.replace(/"/g, '\\"');
        await new Promise((resolve, reject) => {
          const ffmpegCmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t 3 -c copy "${escapedClipPath}"`;
          console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`);
          child_process.exec(ffmpegCmd, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } else {
      const outputPattern = path.join(outDir, "clip_%03d.mp4").replace(/\\/g, "/");
      const escapedOutputPattern = outputPattern.replace(/"/g, '\\"');
      await new Promise((resolve, reject) => {
        const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" -c copy -segment_time 3 -segment_start_number 1 -f segment "${escapedOutputPattern}"`;
        console.log(`[cut-video-clips] Executing FFmpeg: ${ffmpegCmd}`);
        child_process.exec(ffmpegCmd, (err, _stdout, _stderr) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    const files = await fs.promises.readdir(outDir);
    const createdClips = [];
    for (const file of files) {
      if (file.startsWith("clip_") && file.endsWith(".mp4")) {
        const clipPath = path.join(outDir, file);
        const durationSeconds = await getVideoDuration(clipPath);
        const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
        const thumbnailPath = path.join(thumbnailDir, thumbnailName);
        let thumbnailUrl = "";
        try {
          await generateVideoThumbnail(clipPath, thumbnailPath);
          if (await exists(thumbnailPath)) {
            thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbnailPath)).toString("base64")}`;
          }
        } catch (e) {
          console.error(`[cut-video-clips] Error generating thumbnail for ${file}:`, e);
        }
        const stat = await fs.promises.stat(clipPath);
        createdClips.push({
          id: `bank-originales-${file}`,
          name: file,
          path: clipPath,
          url: `file:///${clipPath.replace(/\\/g, "/")}`,
          duration: formatTimeMinutesSeconds(durationSeconds),
          durationSeconds,
          type: "video",
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          thumbnailUrl
        });
      }
    }
    console.log(`[cut-video-clips] Slicing finished. Created ${createdClips.length} clips.`);
    return { success: true, clips: createdClips };
  } catch (err) {
    console.error(`[cut-video-clips] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("read-file-as-blob", async (_event, { filePath }) => {
  try {
    if (!await exists(filePath)) {
      return { success: false, error: `File not found at: ${filePath}` };
    }
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, buffer };
  } catch (err) {
    console.error(`[read-file-as-blob] Error reading file ${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("delete-bank-clip", async (_event, { category, file }) => {
  try {
    const isTempCategory = ["originales", "minimax", "stock"].includes(category.toLowerCase());
    const useActiveProj = !!(activeProjectPath && isTempCategory);
    const baseDir = useActiveProj ? activeProjectPath : getBancoClipsPath();
    const filePath = useActiveProj ? path.join(baseDir, "temp", category, file) : path.join(baseDir, category, file);
    if (await exists(filePath)) {
      await fs.promises.unlink(filePath);
    }
    const thumbnailName = `${path.basename(file, path.extname(file))}.jpg`;
    const thumbnailPath = useActiveProj ? path.join(baseDir, "temp", "thumbnails", thumbnailName) : path.join(baseDir, "thumbnails", thumbnailName);
    if (await exists(thumbnailPath)) {
      await fs.promises.unlink(thumbnailPath);
    }
    return { success: true };
  } catch (err) {
    console.error(`[delete-bank-clip] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("export-video", async (_event, { clips, aspectRatio, resolution, format, quality }) => {
  try {
    if (!win) return { success: false, error: "Ventana no disponible" };
    const ext = format === "mov" ? "mov" : "mp4";
    const filterName = format === "mov" ? "QuickTime Movie" : "MP4 Video";
    const { filePath, canceled } = await electron.dialog.showSaveDialog(win, {
      title: "Exportar Video",
      defaultPath: path.join(electron.app.getPath("downloads"), `export.${ext}`),
      filters: [{ name: filterName, extensions: [ext] }]
    });
    if (canceled || !filePath) {
      return { success: false, error: "Exportación cancelada por el usuario" };
    }
    if (!clips || clips.length === 0) {
      return { success: false, error: "No hay clips en el Timeline para exportar." };
    }
    let targetW = 1920;
    let targetH = 1080;
    if (aspectRatio === "vertical") {
      if (resolution === "4K") {
        targetW = 2160;
        targetH = 3840;
      } else if (resolution === "720p") {
        targetW = 720;
        targetH = 1280;
      } else {
        targetW = 1080;
        targetH = 1920;
      }
    } else if (aspectRatio === "square") {
      if (resolution === "4K") {
        targetW = 2160;
        targetH = 2160;
      } else if (resolution === "720p") {
        targetW = 720;
        targetH = 720;
      } else {
        targetW = 1080;
        targetH = 1080;
      }
    } else {
      if (resolution === "4K") {
        targetW = 3840;
        targetH = 2160;
      } else if (resolution === "720p") {
        targetW = 1280;
        targetH = 720;
      } else {
        targetW = 1920;
        targetH = 1080;
      }
    }
    let filterStr = "";
    if (aspectRatio === "vertical") {
      filterStr = `-vf "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    } else if (aspectRatio === "square") {
      filterStr = `-vf "crop=w='min(iw,ih)':h='min(ih,iw)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    } else {
      filterStr = `-vf "crop=w='min(iw,ih*16/9)':h='min(ih,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${targetW}:${targetH}"`;
    }
    let crf = 23;
    let preset = "fast";
    if (quality === "high") {
      crf = 18;
      preset = "medium";
    } else if (quality === "low") {
      crf = 28;
      preset = "ultrafast";
    }
    const escapedOut = filePath.replace(/"/g, '\\"');
    if (clips.length === 1) {
      const videoPath = clips[0].path;
      if (!videoPath || !await exists(videoPath)) {
        return { success: false, error: `El archivo original no existe o no tiene ruta: ${clips[0].name}` };
      }
      const escapedVideo = videoPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -i "${escapedVideo}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`;
      await new Promise((resolve, reject) => {
        child_process.exec(ffmpegCmd, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      const bankDir = getBancoClipsPath();
      const tempTxtPath = path.join(bankDir, `temp_concat_${Date.now()}.txt`);
      let fileContent = "";
      for (const clip of clips) {
        if (clip.path && await exists(clip.path)) {
          const escapedPath = clip.path.replace(/\\/g, "/").replace(/'/g, "'\\''");
          fileContent += `file '${escapedPath}'
`;
        } else {
          console.warn(`[export-video] Advertencia: clip sin ruta válida en disco: ${clip.name}`);
        }
      }
      if (!fileContent.trim()) {
        return { success: false, error: "Ninguno de los clips del Timeline tiene un archivo de origen válido en disco." };
      }
      await fs.promises.writeFile(tempTxtPath, fileContent, "utf8");
      const escapedTxt = tempTxtPath.replace(/"/g, '\\"');
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${escapedTxt}" ${filterStr} -c:v libx264 -preset ${preset} -crf ${crf} -pix_fmt yuv420p -c:a aac "${escapedOut}"`;
      await new Promise((resolve, reject) => {
        child_process.exec(ffmpegCmd, async (err) => {
          try {
            await fs.promises.unlink(tempTxtPath);
          } catch (e) {
          }
          if (err) reject(err);
          else resolve();
        });
      });
    }
    return { success: true, filePath };
  } catch (err) {
    console.error(`[export-video] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("generate-timeline-assets", async (event, { scriptText, audioDuration, transcriptSegments, videoPath, weights, iaStyle, aspectRatio, graphicsPercent, newAudioSegments }) => {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
  const isOriginalAudio = transcriptSegments && newAudioSegments && transcriptSegments.length === newAudioSegments.length && ((_a = transcriptSegments[0]) == null ? void 0 : _a.start) === ((_b = newAudioSegments[0]) == null ? void 0 : _b.start);
  if (isOriginalAudio && newAudioSegments && Array.isArray(newAudioSegments) && newAudioSegments.length > 0) {
    const merged = [];
    let i = 0;
    while (i < newAudioSegments.length) {
      const seg = { ...newAudioSegments[i] };
      while (i + 1 < newAudioSegments.length && seg.end - seg.start < 2) {
        i++;
        seg.end = newAudioSegments[i].end;
        seg.text = (seg.text || "") + " " + (newAudioSegments[i].text || "");
      }
      merged.push(seg);
      i++;
    }
    if (merged.length < newAudioSegments.length) {
      console.log(`[MERGE] Segmentos: ${newAudioSegments.length} → ${merged.length}`);
    }
    newAudioSegments = merged;
  }
  const logMessage = async (msg) => {
    console.log(msg);
    await writeDebugLog(msg);
  };
  try {
    await logMessage(`[generate-timeline-assets] Iniciando... Guión a procesar: "${scriptText ? scriptText.substring(0, 60) + "..." : ""}"`);
    let totalClips = 0;
    if (newAudioSegments && Array.isArray(newAudioSegments) && newAudioSegments.length > 0) {
      totalClips = newAudioSegments.length;
      await logMessage(`[FASE 1] Usando newAudioSegments con timestamps reales. Total clips: ${totalClips}`);
    } else {
      const errMsg = "No se encontraron los segmentos de audio transcritos de ElevenLabs (newAudioSegments). Por favor, genera la voz primero.";
      await logMessage(`[FASE 1] Error: ${errMsg}`);
      return { success: false, error: errMsg };
    }
    if (!videoPath || !await exists(videoPath)) {
      return { success: false, error: `No se encontró el video original: ${videoPath}` };
    }
    await logMessage("[FASE 2] Solicitando timestamps y tipos de clip a DeepSeek...");
    loadEnv(true);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    const falApiKey = process.env.FAL_KEY;
    if (falApiKey) {
      process.env.FAL_KEY = falApiKey;
    }
    const pexelsApiKey = process.env.PEXELS_API_KEY;
    let clipsDecision = [];
    event.sender.send("generation-progress", {
      index: 0,
      total: totalClips,
      paragraph: "Consultando DeepSeek para seleccionar fragmentos e IA...",
      type: "DeepSeek"
    });
    const maxTsVal = (transcriptSegments == null ? void 0 : transcriptSegments.length) > 0 ? ((_c = transcriptSegments[transcriptSegments.length - 1]) == null ? void 0 : _c.end) ?? audioDuration : audioDuration;
    let totalVisualClipsCount = 0;
    if (newAudioSegments && Array.isArray(newAudioSegments)) {
      newAudioSegments.forEach((seg) => {
        const duration = seg.end - seg.start;
        totalVisualClipsCount += duration > 4 ? Math.ceil(duration / 3) : 1;
      });
    }
    const minimaxWeight = weights ? weights[2] ?? 0 : 0;
    const stockWeight = weights ? weights[1] ?? 0 : 0;
    let targetIaClips = Math.round(minimaxWeight / 100 * totalVisualClipsCount);
    let targetStockClips = Math.round(stockWeight / 100 * totalVisualClipsCount);
    if (targetIaClips + targetStockClips > totalVisualClipsCount) {
      const sum = targetIaClips + targetStockClips;
      targetIaClips = Math.floor(targetIaClips / sum * totalVisualClipsCount);
      targetStockClips = totalVisualClipsCount - targetIaClips;
    }
    const targetOriginalClips = totalVisualClipsCount - targetIaClips - targetStockClips;
    await logMessage(`[FASE 2] weights: original=${targetOriginalClips}, stock=${targetStockClips}, ia=${targetIaClips}/${totalVisualClipsCount}`);
    const pct = typeof graphicsPercent === "number" ? graphicsPercent : 50;
    let sanitizedPhrases = [];
    try {
      const segmentsText = (transcriptSegments || []).map((s, i) => `[${i}] ${Number(s.start).toFixed(1)}s-${Number(s.end).toFixed(1)}s: "${s.text}"`).join("\n");
      const fragmentosNumerados = newAudioSegments.map((seg, idx) => {
        const duration = seg.end - seg.start;
        const count = duration > 4 ? Math.ceil(duration / 3) : 1;
        return `[Frase ${idx + 1}] "${seg.text}" (${Number(seg.start).toFixed(1)}s - ${Number(seg.end).toFixed(1)}s, duración: ${duration.toFixed(2)}s). Requiere exactamente ${count} sub-clip(s) visual(es) de aprox ${(duration / count).toFixed(2)}s cada uno.`;
      }).join("\n");
      const dsPromptClips = `Eres un editor de video. Tienes la transcripción del video original con timestamps y un guión reescrito dividido en frases (con timestamps reales de la voz generada).
Para cada frase del guión, decide cómo ilustrarla. Si la duración de la frase supera los 4.0 segundos, debes dividirla en 2 o 3 sub-clips visuales (máximo 3.0s por sub-clip).
Cada sub-clip visual puede ser de tipo original del video ('original'), buscando un clip de stock ('stock') o generándolo por IA ('ia').

De un total de ${totalVisualClipsCount} sub-clips visuales a generar a lo largo de todas las frases, debes clasificar exactamente:
- ${targetIaClips} sub-clips como de tipo 'ia'
- ${targetStockClips} sub-clips como de tipo 'stock'
- ${targetOriginalClips} sub-clips como de tipo 'original'

TRANSCRIPCIÓN DEL VIDEO ORIGINAL:
${segmentsText}

FRASES DEL GUIÓN A PROCESAR:
${fragmentosNumerados}

INSTRUCCIONES DE CLIPS VISUALES:
- Para cada frase en orden, proporciona el array "visualClips" con el número exacto de sub-clips indicado.
- La suma de las duraciones de los sub-clips dentro de una frase debe ser exactamente igual a la duración total de la frase.
- Para clips tipo 'original': elige el timestamp de inicio más adecuado (rango 0 - ${Number(maxTsVal).toFixed(1)}) basándose en la transcripción del video original.
- Para clips tipo 'stock': genera una palabra clave en inglés corta (1-2 palabras, ej. "cyberpunk city", "financial chart", "nervous man") para buscar en Pexels en el campo "keyword".
- Para clips tipo 'ia': genera un prompt descriptivo en inglés y altamente visual de 1 oración en el campo "prompt".
- Distribuye los tipos de forma intercalada. Alterna entre 'original', 'stock' e 'ia' de forma variada y natural.

Responde ÚNICAMENTE con JSON en este formato sin markdown ni comentarios:
{
  "phrases": [
    {
      "phraseIndex": 1,
      "visualClips": [
        {
          "type": "stock",
          "keyword": "brain connection",
          "duration": 3.0
        },
        {
          "type": "original",
          "timestamp": 12.5,
          "duration": 1.5
        }
      ]
    },
    {
      "phraseIndex": 2,
      "visualClips": [
        {
          "type": "ia",
          "prompt": "A cinematic shot of a computer monitor showing green code scrolling down",
          "duration": 3.2
        }
      ]
    }
  ]
}`;
      const dsPromptGraphics = `Eres un motion designer para videos cortos. Tienes un guión de video segmentado en frases con su respectiva duración.
Debes colocar un gráfico animado superpuesto que apoye visualmente el concepto clave de cada frase.

REGLAS DE COBERTURA Y CALIDAD PARA LOS GRÁFICOS:
1. COBERTURA OBLIGATORIA DEL ${pct}%:
   - Exactamente el ${pct}% de las frases procesadas DEBE tener un gráfico animado asignado. Es obligatorio respetar esta proporción exacta de cobertura.
   - Solo debes asignar 'graphic': null para frases de transición extremadamente cortas (menores a 1.0 segundo de duración).

2. DOS CATEGORÍAS VÁLIDAS DE GRÁFICOS (TIPO A Y TIPO B):
   - TIPO A: Si la frase contiene un dato cuantificable (números, porcentajes, comparaciones, listas, rankings) -> SÍ crear gráfico estructurado usando el tipo adecuado: "contador", "barra_horizontal", "donut", "barras_comparativas", "comparacion_antes_despues", "flecha_crecimiento", "flecha_caida", "multiplicador", "fraccion", "ranking_top3", "lista_numerada", "checklist", "pasos_proceso".
   - TIPO B: Si la frase NO contiene datos cuantificables -> DEBES destacar la idea o concepto principal usando:
     * "decorativo_emoji": con un emoji altamente representativo del concepto y una etiqueta corta (label).
     * "frase_clave": con el texto o frase más impactante (value) de esa frase.

3. EJEMPLOS ESTRICTOS DE TIPO B:
   - Si la frase es "tu mente es un software" -> usar type: "decorativo_emoji", emoji: "🧠", label: "Mente = Software"
   - Si la frase es "dopamina es energía de la carne" -> usar type: "decorativo_emoji", emoji: "🔥", label: "Dopamina"
   - Si la frase es "serotonina es del espíritu" -> usar type: "decorativo_emoji", emoji: "🧘", label: "Serotonina"
   - Si la frase es "el cielo y el infierno viven dentro de ti" -> usar type: "frase_clave", value: "cielo e infierno están en ti"
   - Si la frase es "nada es materia todo es energía" -> usar type: "decorativo_emoji", emoji: "⚡", label: "Todo es Energía"

4. EMOJIS ESPECÍFICOS Y RELEVANTES:
   - El emoji asignado en el campo "emoji" DEBE ser específico al concepto de la frase. NUNCA uses emojis genéricos como 📊 como comodín o fallback.

5. EXTRACCIÓN DE DATOS PRECISA (NATIVOS) Y CAMPO EXTRA:
   - El campo "value" debe conservar su tipo nativo limpio (número real/entero para contadores/barras/donuts, o string para frases o fracciones).
   - Si el gráfico es estructurado, DEBES proporcionar el objeto "extra" con la siguiente estructura:
     * "barras_comparativas" -> extra: { "rightValue": número, "rightLabel": "nombre etiqueta B" }
     * "comparacion_antes_despues" -> extra: { "beforeValue": número/string, "afterValue": número/string }
     * "pasos_proceso", "lista_numerada", "checklist", o "ranking_top3" -> extra: { "steps": ["item 1", "item 2", "item 3"] }

6. REGLA CRÍTICA DE TIEMPO DEL GRÁFICO:
   - "graphicStart": segundo de inicio del gráfico relativo al comienzo de esta frase. Debe ser el momento exacto donde se menciona el concepto clave o palabra más impactante.
   - "graphicEnd": segundo de fin del gráfico relativo al comienzo de esta frase.
   - La duración total del gráfico (graphicEnd - graphicStart) debe ser de máximo 2.0 segundos. Ambos valores deben estar entre 0.0 y la duración total de la frase.

FRASES DEL GUIÓN A PROCESAR:
${fragmentosNumerados}

Responde ÚNICAMENTE con JSON en este formato sin markdown ni comentarios:
{
  "phrases": [
    {
      "phraseIndex": 1,
      "graphic": {
        "type": "contador",
        "value": 70,
        "label": "de personas",
        "unit": "%",
        "emoji": "👥",
        "extra": null,
        "graphicStart": 1.2,
        "graphicEnd": 2.7
      }
    },
    {
      "phraseIndex": 2,
      "graphic": null
    }
  ]
}`;
      let phrasesDecision = [];
      let graphicsDecision = [];
      try {
        await logMessage("[FASE 2] LLAMADA 1: Solicitando clips visuales a DeepSeek...");
        const dsResponseClips = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "Eres un editor de video experto. Responde ÚNICAMENTE con el JSON solicitado." },
              { role: "user", content: dsPromptClips }
            ],
            temperature: 0.2
          })
        });
        if (dsResponseClips.ok) {
          const dsData = await dsResponseClips.json();
          let content = (((_f = (_e = (_d = dsData == null ? void 0 : dsData.choices) == null ? void 0 : _d[0]) == null ? void 0 : _e.message) == null ? void 0 : _f.content) || "").trim();
          if (content.includes("{")) {
            content = content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
          }
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.phrases)) {
            phrasesDecision = parsed.phrases;
          }
        }
      } catch (err) {
        await logMessage(`[FASE 2] Error en llamada de clips: ${err.message}`);
      }
      try {
        await logMessage("[FASE 2] LLAMADA 2: Solicitando motion graphics a DeepSeek...");
        const dsResponseGraphics = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: "Eres un motion designer experto. Responde ÚNICAMENTE con el JSON solicitado." },
              { role: "user", content: dsPromptGraphics }
            ],
            temperature: 0.3
          })
        });
        if (dsResponseGraphics.ok) {
          const dsData = await dsResponseGraphics.json();
          let content = (((_i = (_h = (_g = dsData == null ? void 0 : dsData.choices) == null ? void 0 : _g[0]) == null ? void 0 : _h.message) == null ? void 0 : _i.content) || "").trim();
          if (content.includes("{")) {
            content = content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
          }
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.phrases)) {
            graphicsDecision = parsed.phrases;
          }
        }
      } catch (err) {
        await logMessage(`[FASE 2] Error en llamada de gráficos: ${err.message}`);
      }
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const phraseDuration = seg.end - seg.start;
        const numClipsExpected = phraseDuration > 4 ? Math.ceil(phraseDuration / 3) : 1;
        const matchClips = phrasesDecision.find((p) => p && (p.phraseIndex === idx + 1 || p.index === idx + 1));
        const matchGraphics = graphicsDecision.find((p) => p && (p.phraseIndex === idx + 1 || p.index === idx + 1));
        let visualClips = (matchClips == null ? void 0 : matchClips.visualClips) || (matchClips == null ? void 0 : matchClips.clips);
        if (!Array.isArray(visualClips) || visualClips.length === 0) {
          visualClips = [];
          for (let c = 0; c < numClipsExpected; c++) {
            visualClips.push({
              type: "original",
              timestamp: parseFloat((((_j = newAudioSegments[idx]) == null ? void 0 : _j.start) ?? idx / newAudioSegments.length * maxTsVal).toFixed(1)),
              keyword: "broll",
              prompt: "cinematic video clip",
              duration: phraseDuration / numClipsExpected
            });
          }
        }
        if (visualClips.length !== numClipsExpected) {
          if (visualClips.length < numClipsExpected) {
            while (visualClips.length < numClipsExpected) {
              visualClips.push({
                type: "original",
                timestamp: parseFloat((((_k = newAudioSegments[idx]) == null ? void 0 : _k.start) ?? idx / newAudioSegments.length * maxTsVal).toFixed(1)),
                keyword: "broll",
                prompt: "cinematic video clip",
                duration: phraseDuration / numClipsExpected
              });
            }
          } else {
            visualClips = visualClips.slice(0, numClipsExpected);
          }
        }
        visualClips = visualClips.map((c) => {
          var _a2;
          const type = ["original", "stock", "ia"].includes(c.type) ? c.type : "original";
          const effectiveTimestamp = isOriginalAudio && type === "original" && ((_a2 = newAudioSegments[idx]) == null ? void 0 : _a2.start) !== void 0 ? newAudioSegments[idx].start : c.timestamp ?? parseFloat((idx / newAudioSegments.length * maxTsVal).toFixed(1));
          return {
            type,
            timestamp: effectiveTimestamp,
            keyword: c.keyword || "broll",
            prompt: c.prompt || "cinematic video clip",
            duration: parseFloat((c.duration || phraseDuration / numClipsExpected).toFixed(2))
          };
        });
        const sumProposed = visualClips.reduce((acc, c) => acc + (c.duration || 0), 0);
        if (sumProposed <= 0.05 || visualClips.some((c) => c.duration <= 0.05)) {
          let runningSum = 0;
          for (let i = 0; i < visualClips.length; i++) {
            if (i === visualClips.length - 1) {
              visualClips[i].duration = parseFloat((phraseDuration - runningSum).toFixed(2));
            } else {
              const val = parseFloat((phraseDuration / visualClips.length).toFixed(2));
              visualClips[i].duration = val;
              runningSum += val;
            }
          }
        } else {
          let runningSum = 0;
          for (let i = 0; i < visualClips.length; i++) {
            if (i === visualClips.length - 1) {
              visualClips[i].duration = parseFloat((phraseDuration - runningSum).toFixed(2));
            } else {
              const scaled = visualClips[i].duration / sumProposed * phraseDuration;
              visualClips[i].duration = parseFloat(scaled.toFixed(2));
              runningSum += visualClips[i].duration;
            }
          }
        }
        let graphic = matchGraphics == null ? void 0 : matchGraphics.graphic;
        if (graphic && typeof graphic === "object") {
          const type = graphic.type || "decorativo_emoji";
          let start = parseFloat(Number(graphic.graphicStart).toFixed(2));
          let end = parseFloat(Number(graphic.graphicEnd).toFixed(2));
          if (isNaN(start) || start < 0) start = 0;
          if (start > phraseDuration) start = phraseDuration;
          if (isNaN(end) || end < start) end = start + 2;
          if (end > phraseDuration) end = phraseDuration;
          let dur = end - start;
          if (dur > 2) {
            end = parseFloat((start + 2).toFixed(2));
            if (end > phraseDuration) {
              end = phraseDuration;
              start = parseFloat(Math.max(0, end - 2).toFixed(2));
            }
          }
          if (end - start < 0.2) {
            start = parseFloat(Math.max(0, end - 1).toFixed(2));
            end = parseFloat(Math.min(phraseDuration, start + 1).toFixed(2));
          }
          graphic = {
            type,
            value: graphic.value !== void 0 ? graphic.value : "📊",
            label: graphic.label || "Concepto clave",
            unit: graphic.unit || "",
            emoji: graphic.emoji || "💡",
            graphicStart: start,
            graphicEnd: end,
            extra: graphic.extra !== void 0 ? graphic.extra : null
          };
        } else {
          graphic = null;
        }
        sanitizedPhrases.push({
          phraseIndex: idx + 1,
          visualClips,
          graphic
        });
      }
    } catch (e) {
      await logMessage(`[FASE 2] DeepSeek error: ${e.message}. Usando fallback.`);
    }
    if (sanitizedPhrases.length === 0) {
      for (let idx = 0; idx < newAudioSegments.length; idx++) {
        const seg = newAudioSegments[idx];
        const phraseDuration = seg.end - seg.start;
        const numClipsExpected = phraseDuration > 4 ? Math.ceil(phraseDuration / 3) : 1;
        const visualClips = [];
        let runningSum = 0;
        for (let c = 0; c < numClipsExpected; c++) {
          let dur = 0;
          if (c === numClipsExpected - 1) {
            dur = parseFloat((phraseDuration - runningSum).toFixed(2));
          } else {
            dur = parseFloat((phraseDuration / numClipsExpected).toFixed(2));
            runningSum += dur;
          }
          visualClips.push({
            type: "original",
            timestamp: parseFloat((((_l = newAudioSegments[idx]) == null ? void 0 : _l.start) ?? idx / newAudioSegments.length * maxTsVal).toFixed(1)),
            keyword: "broll",
            prompt: "cinematic video clip",
            duration: dur
          });
        }
        sanitizedPhrases.push({
          phraseIndex: idx + 1,
          visualClips,
          graphic: null
        });
      }
      await logMessage(`[FASE 2] Fallback: ${newAudioSegments.length} frases procesadas uniformemente.`);
    }
    let consecutiveType = "";
    let consecutiveCount = 0;
    for (let i = 0; i < sanitizedPhrases.length; i++) {
      const g = sanitizedPhrases[i].graphic;
      if (g && g.type) {
        if (g.type === consecutiveType) {
          consecutiveCount++;
          if (consecutiveCount >= 3) {
            g.type = "decorativo_emoji";
            g.value = g.emoji || "📊";
            consecutiveType = "decorativo_emoji";
            consecutiveCount = 1;
          }
        } else {
          consecutiveType = g.type;
          consecutiveCount = 1;
        }
      } else {
        consecutiveType = "";
        consecutiveCount = 0;
      }
    }
    const minGraphicsCount = Math.round(pct / 100 * sanitizedPhrases.length);
    const currentGraphicsCount = sanitizedPhrases.filter((p) => p.graphic !== null).length;
    const needed = minGraphicsCount - currentGraphicsCount;
    if (needed > 0) {
      const eligibleIndices = [];
      for (let i = 0; i < sanitizedPhrases.length; i++) {
        if (!sanitizedPhrases[i].graphic) {
          eligibleIndices.push(i);
        }
      }
      if (eligibleIndices.length > 0) {
        const step = eligibleIndices.length / needed;
        for (let j = 0; j < needed; j++) {
          const idx = eligibleIndices[Math.floor(j * step)];
          if (idx !== void 0 && sanitizedPhrases[idx]) {
            const phraseDuration = newAudioSegments[idx].end - newAudioSegments[idx].start;
            const start = parseFloat((phraseDuration * 0.1).toFixed(2));
            const end = parseFloat(Math.min(phraseDuration, start + 1.2).toFixed(2));
            sanitizedPhrases[idx].graphic = {
              type: "decorativo_emoji",
              value: "📊",
              label: "Dato de interés",
              unit: "",
              emoji: "📊",
              graphicStart: start,
              graphicEnd: end
            };
          }
        }
      }
    }
    const flattenedClips = [];
    let globalIdx = 1;
    for (let phraseIdx = 0; phraseIdx < sanitizedPhrases.length; phraseIdx++) {
      const phrase = sanitizedPhrases[phraseIdx];
      for (let clipIdx = 0; clipIdx < phrase.visualClips.length; clipIdx++) {
        const subClip = phrase.visualClips[clipIdx];
        flattenedClips.push({
          index: globalIdx,
          phraseIndex: phraseIdx,
          clipIndexInPhrase: clipIdx,
          type: subClip.type,
          timestamp: subClip.timestamp,
          keyword: subClip.keyword,
          prompt: subClip.prompt,
          duration: subClip.duration,
          graphic: null
        });
        globalIdx++;
      }
    }
    clipsDecision = flattenedClips;
    totalClips = flattenedClips.length;
    await logMessage(`[FASE 2] Decisiones de clips listas. Sub-clips totales: ${clipsDecision.length}. Clips IA: ${clipsDecision.filter((c) => c.type === "ia").length}, Stock: ${clipsDecision.filter((c) => c.type === "stock").length}, Original: ${clipsDecision.filter((c) => c.type === "original").length}, Gráficos asignados: ${sanitizedPhrases.filter((p) => p.graphic !== null).length}`);
    await logMessage(`[FASE 3] Generando ${totalClips} clips con FFmpeg, Pexels y fal.ai (IA)...`);
    const outDir = activeProjectPath ? path.join(activeProjectPath, "temp", "originales") : path.join(getBancoClipsPath(), "originales");
    if (!await exists(outDir)) await fs.promises.mkdir(outDir, { recursive: true });
    const thumbDir = activeProjectPath ? path.join(activeProjectPath, "temp", "thumbnails") : path.join(getBancoClipsPath(), "thumbnails");
    if (!await exists(thumbDir)) await fs.promises.mkdir(thumbDir, { recursive: true });
    const results = new Array(totalClips);
    const escapedVideo = videoPath.replace(/"/g, '\\"');
    const queue2 = [...clipsDecision];
    const workers = Array(3).fill(null).map(async () => {
      var _a2, _b2, _c2, _d2;
      while (queue2.length > 0) {
        const item = queue2.shift();
        if (!item) break;
        const clipNum = String(item.index).padStart(3, "0");
        const clipPath = path.join(outDir, `clip_${clipNum}.mp4`);
        const escapedClip = clipPath.replace(/"/g, '\\"');
        const thumbPath = path.join(thumbDir, `clip_${clipNum}.jpg`);
        event.sender.send("generation-progress", {
          index: item.index - 1,
          total: totalClips,
          paragraph: `Procesando clip ${item.index}/${totalClips} [${item.type}]`,
          type: item.type === "ia" ? "IA" : item.type === "stock" ? "Stock" : "FFmpeg"
        });
        let success = false;
        if (item.type === "ia") {
          try {
            let promptFinal = item.prompt || "cinematic video clip";
            if (iaStyle === "cartoon") {
              promptFinal += ", 3D cartoon style, vibrant colors, Pixar animation movie style";
            } else if (iaStyle === "bw") {
              promptFinal += ", black and white, classic film noir movie style, moody lighting";
            }
            const result = await src.fal.subscribe("fal-ai/minimax/video-01", {
              input: { prompt: promptFinal }
            });
            const downloadUrl = ((_a2 = result == null ? void 0 : result.video) == null ? void 0 : _a2.url) || ((_c2 = (_b2 = result == null ? void 0 : result.data) == null ? void 0 : _b2.video) == null ? void 0 : _c2.url);
            if (!downloadUrl) throw new Error("No se recibió la URL de video de fal.ai");
            const downloadRes = await fetch(downloadUrl);
            if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.statusText}`);
            const arrayBuffer = await downloadRes.arrayBuffer();
            const tempVideoPath = path.join(outDir, `temp_ia_${clipNum}.mp4`);
            await fs.promises.writeFile(tempVideoPath, Buffer.from(arrayBuffer));
            await new Promise((resolve, reject) => {
              const cmd = `ffmpeg -y -ss 0 -i "${tempVideoPath}" -t ${item.duration} -c:v libx264 -c:a aac "${escapedClip}"`;
              child_process.exec(cmd, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            try {
              await fs.promises.unlink(tempVideoPath);
            } catch (e) {
            }
            success = true;
          } catch (iaErr) {
            await logMessage(`[FASE 3] Error IA en clip ${item.index}: ${iaErr.message || iaErr}. Usando fallback original.`);
            item.type = "original";
            item.timestamp = parseFloat(((item.index - 1) / totalClips * maxTsVal).toFixed(1));
          }
        }
        if (item.type === "stock") {
          try {
            if (!pexelsApiKey) throw new Error("No se configuró PEXELS_API_KEY en el archivo .env");
            const isVertical = aspectRatio === "9:16" || aspectRatio === "vertical";
            const targetOrientation = isVertical ? "portrait" : "landscape";
            const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(item.keyword || "broll")}&per_page=5&orientation=${targetOrientation}`;
            await logMessage(`[FASE 3] Buscando stock en Pexels para clip ${item.index}: "${item.keyword}" (orientación: ${targetOrientation})`);
            const pexelsRes = await fetch(pexelsUrl, {
              headers: { "Authorization": pexelsApiKey }
            });
            if (!pexelsRes.ok) {
              throw new Error(`Pexels API respondió con status ${pexelsRes.status}`);
            }
            const pexelsData = await pexelsRes.json();
            const video = (_d2 = pexelsData == null ? void 0 : pexelsData.videos) == null ? void 0 : _d2[0];
            if (!video) throw new Error(`No se encontraron videos en Pexels para keyword: ${item.keyword}`);
            const videoFiles = video.video_files || [];
            let bestFile = videoFiles.find((f) => f.quality === "hd" || f.width >= 720);
            if (!bestFile) bestFile = videoFiles[0];
            const videoDownloadUrl = bestFile == null ? void 0 : bestFile.link;
            if (!videoDownloadUrl) throw new Error("No se encontró link de descarga en el video de Pexels");
            const stockDir = path.join(getBancoClipsPath(), "stock");
            if (!await exists(stockDir)) {
              await fs.promises.mkdir(stockDir, { recursive: true });
            }
            const rawStockFilename = `pexels_${video.id}_raw.mp4`;
            const rawStockPath = path.join(stockDir, rawStockFilename);
            if (!await exists(rawStockPath)) {
              await logMessage(`[FASE 3] Descargando original de stock de Pexels: ${videoDownloadUrl}`);
              const dlRes = await fetch(videoDownloadUrl);
              if (!dlRes.ok) throw new Error(`Error al descargar video de Pexels: ${dlRes.statusText}`);
              const buffer = await dlRes.arrayBuffer();
              await fs.promises.writeFile(rawStockPath, Buffer.from(buffer));
            } else {
              await logMessage(`[FASE 3] Usando original de stock de Pexels existente en caché: ${rawStockFilename}`);
            }
            let filter2 = "";
            try {
              const dimensions = await getVideoDimensions(rawStockPath);
              const isVerticalOutput = aspectRatio === "9:16" || aspectRatio === "vertical";
              if (isVerticalOutput) {
                if (dimensions.width > dimensions.height) {
                  filter2 = "crop=ih*9/16:ih,scale=1080:1920,setpts=0.8*PTS";
                } else {
                  filter2 = "crop=iw:iw*16/9,scale=1080:1920,setpts=0.8*PTS";
                }
              } else {
                if (dimensions.width > dimensions.height) {
                  filter2 = "crop=iw:iw*9/16,scale=1920:1080,setpts=0.8*PTS";
                } else {
                  filter2 = "crop=iw:iw*9/16,scale=1920:1080,setpts=0.8*PTS";
                }
              }
            } catch (dimErr) {
              const isVertical2 = aspectRatio === "9:16" || aspectRatio === "vertical";
              filter2 = isVertical2 ? "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS" : "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=0.8*PTS";
            }
            const escapedRawStock = rawStockPath.replace(/"/g, '\\"');
            await new Promise((resolve, reject) => {
              const cmd = `ffmpeg -y -ss 0 -i "${escapedRawStock}" -vf "${filter2}" -t ${item.duration} -an "${escapedClip}"`;
              child_process.exec(cmd, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            if (activeProjectPath) {
              const localStockDir = path.join(activeProjectPath, "temp", "stock");
              if (!await exists(localStockDir)) {
                await fs.promises.mkdir(localStockDir, { recursive: true });
              }
              const localStockPath = path.join(localStockDir, `pexels_${video.id}.mp4`);
              await fs.promises.copyFile(clipPath, localStockPath);
            }
            success = true;
          } catch (stockErr) {
            await logMessage(`[FASE 3] Error Stock en clip ${item.index}: ${stockErr.message || stockErr}. Usando fallback original.`);
            item.type = "original";
            item.timestamp = parseFloat(((item.index - 1) / totalClips * maxTsVal).toFixed(1));
          }
        }
        if (item.type === "original") {
          const ts = item.timestamp ?? 0;
          await logMessage(`[DEBUG_ORIG] clip ${item.index} ts=${ts} duration=${item.duration}`);
          try {
            await new Promise((resolve, reject) => {
              const cmd = `ffmpeg -y -ss ${ts} -i "${escapedVideo}" -t ${item.duration} -c copy "${escapedClip}"`;
              child_process.exec(cmd, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            success = true;
          } catch (ffErr) {
            await logMessage(`[FASE 3] FFmpeg error clip ${item.index}: ${ffErr.message}`);
          }
        }
        if (success && await exists(clipPath)) {
          const durationSeconds = await getVideoDuration(clipPath);
          let thumbnailUrl = "";
          try {
            await generateVideoThumbnail(clipPath, thumbPath);
            if (await exists(thumbPath)) {
              thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString("base64")}`;
            }
          } catch (e) {
          }
          const stat = await fs.promises.stat(clipPath);
          results[item.index - 1] = {
            id: `bank-originales-clip_${clipNum}.mp4`,
            name: `clip_${clipNum}.mp4`,
            path: clipPath,
            url: `file:///${clipPath.replace(/\\/g, "/")}`,
            duration: formatTimeMinutesSeconds(durationSeconds),
            durationSeconds,
            type: "video",
            category: item.type === "ia" ? "minimax" : item.type === "stock" ? "stock" : "original",
            size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
            thumbnailUrl
          };
        }
      }
    });
    await Promise.all(workers);
    const createdClips = results.filter((c) => c !== void 0);
    if (createdClips.length < totalClips && createdClips.length > 0) {
      const before = createdClips.length;
      while (createdClips.length < totalClips) {
        const last = createdClips[createdClips.length - 1];
        createdClips.push({ ...last, id: `${last.id}-dup-${createdClips.length}` });
      }
      await logMessage(`[FASE 4] Duplicados: ${before} → ${createdClips.length} clips.`);
    }
    if (createdClips.length === 0) {
      return { success: false, error: "No se pudo crear ningún clip. Verifica la configuración de las APIs y FFmpeg." };
    }
    await logMessage("[FASE 5] Ensamblando timeline...");
    let currentStart = 0;
    const finalClips = [];
    const graphicClips = [];
    let globalClipIdx = 0;
    for (let phraseIdx = 0; phraseIdx < sanitizedPhrases.length; phraseIdx++) {
      const phrase = sanitizedPhrases[phraseIdx];
      const phraseStartSeconds = ((_m = newAudioSegments[phraseIdx]) == null ? void 0 : _m.start) ?? currentStart;
      await logMessage(`[DEBUG3] phraseIdx=${phraseIdx} phraseStartSeconds=${phraseStartSeconds} currentStart=${currentStart}`);
      for (let clipIdx = 0; clipIdx < phrase.visualClips.length; clipIdx++) {
        const clip = createdClips[globalClipIdx];
        globalClipIdx++;
        if (!clip) continue;
        clip.startSeconds = phraseStartSeconds + (clipIdx > 0 ? sanitizedPhrases[phraseIdx].visualClips.slice(0, clipIdx).reduce((sum, c) => sum + (c.duration ?? 2), 0) : 0);
        clip.phraseIdx = phraseIdx;
        clip.graphic = null;
        if (clip.startSeconds >= audioDuration) {
          try {
            if (await exists(clip.path)) {
              await fs.promises.unlink(clip.path);
              const thumbPath = clip.path.replace("temp/originales", "temp/thumbnails").replace(".mp4", ".jpg").replace("banco-clips/originales", "banco-clips/thumbnails");
              if (await exists(thumbPath)) await fs.promises.unlink(thumbPath);
            }
          } catch (e) {
          }
          continue;
        }
        if (clip.startSeconds + clip.durationSeconds > audioDuration) {
          const targetDuration = parseFloat((audioDuration - clip.startSeconds).toFixed(2));
          if (targetDuration > 0) {
            const tempTrimPath = clip.path.replace(".mp4", "_trimmed.mp4");
            const escapedClip = clip.path.replace(/"/g, '\\"');
            const escapedTemp = tempTrimPath.replace(/"/g, '\\"');
            try {
              await new Promise((resolve, reject) => {
                const cmd = `ffmpeg -y -i "${escapedClip}" -t ${targetDuration} -c:v libx264 -c:a aac "${escapedTemp}"`;
                child_process.exec(cmd, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
              if (await exists(tempTrimPath)) {
                try {
                  await fs.promises.unlink(clip.path);
                } catch (e) {
                }
                await fs.promises.rename(tempTrimPath, clip.path);
                clip.durationSeconds = targetDuration;
                clip.duration = formatTimeMinutesSeconds(targetDuration);
                const stat = await fs.promises.stat(clip.path);
                clip.size = `${(stat.size / (1024 * 1024)).toFixed(2)} MB`;
                const thumbPath = clip.path.replace("temp/originales", "temp/thumbnails").replace(".mp4", ".jpg").replace("banco-clips/originales", "banco-clips/thumbnails");
                try {
                  await generateVideoThumbnail(clip.path, thumbPath);
                  if (await exists(thumbPath)) {
                    clip.thumbnailUrl = `data:image/jpeg;base64,${(await fs.promises.readFile(thumbPath)).toString("base64")}`;
                  }
                } catch (e) {
                }
              }
            } catch (trimErr) {
              await logMessage(`[FASE 5] Error al recortar clip final ${clip.name}: ${trimErr.message}`);
            }
          }
        }
        finalClips.push(clip);
        currentStart += clip.durationSeconds;
      }
      if (phrase.graphic) {
        const startSec = phraseStartSeconds + phrase.graphic.graphicStart;
        const durSec = phrase.graphic.graphicEnd - phrase.graphic.graphicStart;
        if (startSec < audioDuration && durSec > 0) {
          graphicClips.push({
            id: "timeline-graphic-" + Math.random(),
            name: "Gráfico: " + (phrase.graphic.label || phrase.graphic.type),
            startSeconds: startSec,
            graphicStartRelative: phrase.graphic.graphicStart,
            phraseIdx,
            durationSeconds: Math.min(durSec, audioDuration - startSec),
            type: "graphic",
            graphicData: {
              type: phrase.graphic.type,
              value: phrase.graphic.value,
              label: phrase.graphic.label,
              unit: phrase.graphic.unit,
              emoji: phrase.graphic.emoji,
              extra: phrase.graphic.extra
            }
          });
        }
      }
    }
    finalClips.push(...graphicClips);
    await logMessage(`[generate-timeline-assets] Completado. Clips: ${finalClips.length} (Videos: ${finalClips.filter((c) => c.type === "video").length}, Gráficos: ${finalClips.filter((c) => c.type === "graphic").length})`);
    return { success: true, clips: finalClips };
  } catch (err) {
    const errMsg = `[generate-timeline-assets] Error: ${err.message || err}`;
    console.error(errMsg, err);
    await writeDebugLog(errMsg);
    return { success: false, error: err.message || "Error interno" };
  }
});
electron.ipcMain.handle("regenerate-graphics", async (_event, { scriptText, clips, graphicsPercent }) => {
  var _a, _b, _c;
  try {
    console.log("[regenerate-graphics] Iniciando...");
    loadEnv(true);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { success: false, error: "No se configuró DEEPSEEK_API_KEY en el archivo .env" };
    const totalClips = clips.length;
    const targetGraphicsCount = Math.round(graphicsPercent / 100 * totalClips);
    console.log(`[regenerate-graphics] Clips totales: ${totalClips}, Gráficos a generar: ${targetGraphicsCount}`);
    let generatedClips = clips.map((c) => ({ ...c }));
    if (targetGraphicsCount <= 0) {
      return { success: true, clips: generatedClips };
    }
    const sentences = (scriptText || "").split(new RegExp("(?<=[.!?])\\s+")).filter((s) => s.trim().length > 0);
    const fragments = [];
    if (sentences.length <= totalClips) {
      for (let i = 0; i < totalClips; i++) {
        fragments.push(sentences[i] || sentences[sentences.length - 1] || "");
      }
    } else {
      const k = sentences.length / totalClips;
      for (let i = 0; i < totalClips; i++) {
        const start = Math.floor(i * k);
        const end = Math.floor((i + 1) * k);
        fragments.push(sentences.slice(start, end).join(" "));
      }
    }
    const fragmentosNumerados = fragments.map((frag, idx) => {
      var _a2, _b2;
      return `ID del clip: "${((_a2 = clips[idx]) == null ? void 0 : _a2.id) || idx}", Nombre del clip: "${(_b2 = clips[idx]) == null ? void 0 : _b2.name}", Fragmento: "${frag}"`;
    }).join("\n");
    const dsPrompt = `Eres un motion designer para videos cortos. Tienes un guión de un video segmentado en clips.
Debes elegir exactamente ${targetGraphicsCount} clips de la lista para colocarles un gráfico animado superpuesto que apoye visualmente lo que se narra en el fragmento.

Tipos de gráficos disponibles ("type"):
- "contador": un contador numérico animado (ej. value: 80, unit: "k", label: "seguidores").
- "barra_horizontal": una barra de progreso horizontal (ej. value: 75, unit: "%", label: "avance").
- "barra_vertical": una barra vertical que sube (ej. value: 90, unit: "pts", label: "rendimiento").
- "barras_comparativas": dos barras para comparar datos (ej. value: 70, label: "Mención A", extra: { rightValue: 50, rightLabel: "Mención B" }).
- "donut": un gráfico circular animado de porcentaje (ej. value: 65, unit: "%", label: "retención").
- "comparacion_antes_despues": muestra un cambio antes/después (ej. value: 10, label: "millones", unit: "M", extra: { beforeValue: 1, afterValue: 10 }).
- "flecha_crecimiento": flecha verde indicando subida (ej. value: 45, unit: "%", label: "crecimiento").
- "flecha_caida": flecha roja indicando bajada (ej. value: 15, unit: "%", label: "caída").
- "multiplicador": factor multiplicador (ej. value: 5, label: "retorno").
- "fraccion": fracción numérica destacada (ej. value: "9/10", label: "usuarios").
- "ranking_top3": podio de 3 posiciones (ej. value: "Elemento 1,Elemento 2,Elemento 3", extra: { top3: ["1st", "2nd", "3rd"] }).
- "dato_grande": número destacado gigante (ej. value: 250, label: "millones").
- "frase_clave": texto limpio y destacado (ej. value: "ENFOQUE ABSOLUTO").
- "decorativo_emoji": emoji grande relevante (ej. value: "💡", label: "Idea").
- "lista_numerada": items ordenados (ej. value: "Paso A,Paso B").
- "checklist": items marcados (ej. value: "Item A,Item B").
- "pasos_proceso": secuencia conectada (ej. value: "Fase 1->Fase 2->Fase 3").

LISTA DE CLIPS:
${fragmentosNumerados}

INSTRUCCIONES:
1. Elige exactamente ${targetGraphicsCount} clips para tener gráficos. Los demás no tendrán gráficos (deben omitirse o no llevar graphicData).
2. Genera los campos apropiados para "graphicData": type, value, label, unit, emoji, extra.
- CONTEXTO OBLIGATORIO: Analiza el fragmento del guión y extrae el dato más impactante. Si menciona número, porcentaje, comparación, ranking o concepto clave → úsalo.
- EMOJIS: Elige el emoji más representativo del tema del fragmento.
- EJEMPLOS:
  * 'el 70% de colombianos no tiene ahorros' → barra_horizontal, value:70, label:'sin ahorros', unit:'%', emoji:'💰'
  * 'pasó de ganar 1M a 10M en un año' → comparacion_antes_despues, value:10, label:'millones', unit:'M', emoji:'📈', extra: { beforeValue: 1, afterValue: 10 }
  * 'el método tiene 3 pasos' → pasos_proceso, label:'3 pasos clave', emoji:'🎯', extra: { steps: ['Planificar', 'Ejecutar', 'Medir'] }
  * 'creció 5 veces su inversión' → multiplicador, value:5, label:'retorno', emoji:'🚀'
  * '9 de cada 10 expertos recomiendan' → fraccion, value:9, unit:'/10', label:'expertos', emoji:'⭐'
- NUNCA uses decorativo_emoji si hay algún dato cuantificable en el fragmento.

Responde ÚNICAMENTE con un JSON en este formato sin markdown ni comentarios:
{
  "clips": [
    {
      "id": "id_del_clip_elegido",
      "graphicData": {
        "type": "contador",
        "value": 150,
        "label": "Etiqueta",
        "unit": "ms",
        "emoji": "⏱️"
      }
    }
  ]
}`;
    const dsResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Eres un motion designer experto. Responde ÚNICAMENTE con el JSON solicitado." },
          { role: "user", content: dsPrompt }
        ],
        temperature: 0.3
      })
    });
    if (dsResponse.ok) {
      const dsData = await dsResponse.json();
      let content = (((_c = (_b = (_a = dsData == null ? void 0 : dsData.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) || "").trim();
      if (content.includes("{")) {
        content = content.substring(content.indexOf("{"), content.lastIndexOf("}") + 1);
      }
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.clips)) {
        parsed.clips.forEach((pc) => {
          const matchingClip = generatedClips.find((c) => c.id === pc.id || c.name === pc.name);
          if (matchingClip && pc.graphicData) {
            matchingClip.graphicData = pc.graphicData;
          }
        });
      }
    }
    return { success: true, clips: generatedClips };
  } catch (err) {
    console.error("Error en regenerate-graphics:", err);
    const targetGraphicsCount = Math.round(graphicsPercent / 100 * clips.length);
    const generatedClips = clips.map((c, idx) => {
      const copy = { ...c };
      if (idx < targetGraphicsCount) {
        copy.graphicData = {
          type: "frase_clave",
          value: "CLAVE " + (idx + 1),
          label: "Concepto clave"
        };
      }
      return copy;
    });
    return { success: true, clips: generatedClips };
  }
});
//# sourceMappingURL=index.js.map
