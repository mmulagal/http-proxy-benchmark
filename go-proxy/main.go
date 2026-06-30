package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

func main() {
	targetURL, err := url.Parse("http://localhost:9000")
	if err != nil {
		log.Fatalf("Invalid target URL: %v", err)
	}

	// Default MaxIdleConnsPerHost=2 causes TCP connection thrash at high VU counts.
	// Match the concurrency level so connections are reused instead of recreated.
	transport := &http.Transport{
		MaxIdleConns:          1000,
		MaxIdleConnsPerHost:   1000,
		MaxConnsPerHost:       1000,
		IdleConnTimeout:       90 * time.Second,
		DisableCompression:    true,
		ResponseHeaderTimeout: 10 * time.Second,
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.Transport = transport
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("Proxy error: %v", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"ok":true,"service":"go-proxy","timestamp":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

	port := ":8001"
	log.Printf("Go proxy listening on %s, forwarding to %s", port, targetURL)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
