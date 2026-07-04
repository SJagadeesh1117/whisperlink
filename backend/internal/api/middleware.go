package api

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

var (
	visitors = make(map[string]*visitor)
	mu       sync.Mutex
)

type visitor struct {
	lastSeen time.Time
	count    int
}

func getVisitor(ip string) *visitor {
	mu.Lock()
	defer mu.Unlock()

	v, exists := visitors[ip]
	if !exists {
		v = &visitor{lastSeen: time.Now(), count: 0}
		visitors[ip] = v
	}
	return v
}

func RateLimitMiddleware() gin.HandlerFunc {
	// Cleanup background routine
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.lastSeen) > 3*time.Minute {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		v := getVisitor(ip)

		mu.Lock()
		// Allow 15 requests per 10 second window
		if time.Since(v.lastSeen) > 10*time.Second {
			v.count = 0
		}
		v.count++
		v.lastSeen = time.Now()
		count := v.count
		mu.Unlock()

		if count > 15 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func SetupMiddleware(r *gin.Engine) {
	r.Use(gin.Recovery())
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(RateLimitMiddleware())
	
	// Hardened CORS Configuration
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true, // Required to allow Vercel Frontend to talk to Railway Backend
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		MaxAge:           12 * time.Hour,
	}))
}
