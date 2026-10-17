/**
 * Deep Browser Extension — Native Video Session Recorder
 * ======================================================
 *
 * Implements 100% in-browser tab video session recording using:
 *   - chrome.tabCapture API
 *   - navigator.mediaDevices.getUserMedia with chromeMediaSource
 *   - HTML5 MediaRecorder (video/webm;codecs=vp9)
 *   - Zero external binary dependencies (no cloud servers, no ffmpeg subprocesses)
 *   - Automatic Blob generation, in-chat video preview player, and local file download
 */

(function(global) {
  'use strict';

  class SessionRecorder {
    constructor(options = {}) {
      this.tabId = options.tabId || null;
      this.mediaRecorder = null;
      this.mediaStream = null;
      this.recordedChunks = [];
      this.startTime = null;
      this.endTime = null;
      this.isRecording = false;
      this.lastRecordedBlob = null;
      this.lastRecordedUrl = null;
    }

    /**
     * Checks if tab capture and MediaRecorder are supported in the current environment.
     * @returns {boolean}
     */
    static isSupported() {
      return typeof window !== 'undefined' &&
             typeof MediaRecorder !== 'undefined' &&
             typeof navigator !== 'undefined' &&
             !!navigator.mediaDevices?.getUserMedia;
    }

    /**
     * Starts recording the specified tab.
     * @param {number} tabId
     * @returns {Promise<boolean>}
     */
    async startRecording(tabId) {
      if (!tabId) throw new Error('Tab ID is required to start recording');
      if (this.isRecording) return true;

      this.tabId = tabId;
      this.recordedChunks = [];

      try {
        let stream = null;

        // Strategy 1: chrome.tabCapture.getMediaStreamId + getUserMedia
        if (typeof chrome !== 'undefined' && chrome.tabCapture?.getMediaStreamId) {
          const streamId = await new Promise((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId({ targetTabId: this.tabId }, (id) => {
              if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
              }
              resolve(id);
            });
          });

          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080,
                maxFrameRate: 30,
              },
            },
          });
        } else if (navigator.mediaDevices?.getDisplayMedia) {
          // Fallback strategy: getDisplayMedia (if tabCapture permission not yet active)
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: false,
          });
        }

        if (!stream) {
          throw new Error('Unable to acquire tab video media stream.');
        }

        this.mediaStream = stream;

        // Select optimal MIME type supported by Chromium
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // 2.5 Mbps crisp quality
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.start(1000); // 1s timeslices
        this.startTime = Date.now();
        this.isRecording = true;
        return true;
      } catch (err) {
        console.warn('[SessionRecorder] Could not start recording:', err);
        this.isRecording = false;
        return false;
      }
    }

    /**
     * Stops the active recording session and packages the video file.
     * @returns {Promise<Object>} { blob, videoUrl, durationSeconds, sizeBytes }
     */
    async stopRecording() {
      if (!this.isRecording || !this.mediaRecorder) {
        return null;
      }

      return new Promise((resolve) => {
        this.mediaRecorder.onstop = () => {
          this.endTime = Date.now();
          const durationSeconds = Math.round(((this.endTime - (this.startTime || this.endTime)) / 1000) * 10) / 10;

          // Release video tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
          }

          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          const videoUrl = URL.createObjectURL(blob);
          this.lastRecordedBlob = blob;
          this.lastRecordedUrl = videoUrl;
          this.isRecording = false;

          resolve({
            blob,
            videoUrl,
            durationSeconds,
            sizeBytes: blob.size,
            fileName: `deep_browser_session_${Date.now()}.webm`,
          });
        };

        try {
          this.mediaRecorder.stop();
        } catch (_) {
          this.isRecording = false;
          resolve(null);
        }
      });
    }

    /**
     * Downloads the recorded video to user's local disk.
     * @param {string} [fileName]
     */
    downloadRecording(fileName = `deep_browser_session_${Date.now()}.webm`) {
      if (!this.lastRecordedBlob && !this.lastRecordedUrl) return;

      const url = this.lastRecordedUrl || URL.createObjectURL(this.lastRecordedBlob);
      if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
        chrome.downloads.download({
          url,
          filename: fileName,
          saveAs: true,
        });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 200);
      }
    }
  }

  global.SessionRecorder = SessionRecorder;
})(typeof window !== 'undefined' ? window : this);
