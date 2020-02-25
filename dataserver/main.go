package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"

	"github.com/dylan-mitchell/ParseTakeout"
)

//Files from Google Takeout out that ParseTakeout currently supports
var filesToParse = []string{
	"My Activity/Chrome/MyActivity.html",
	"My Activity/Search/MyActivity.html",
	"My Activity/Assistant/MyActivity.html",
	// "My Activity/Android/MyActivity.html",
	"My Activity/Developers/MyActivity.html",
	"My Activity/Ads/MyActivity.html",
	"My Activity/News/MyActivity.html",
	"My Activity/Podcasts/MyActivity.html",
	"My Activity/YouTube/MyActivity.html",
	"YouTube/history/search-history.html",
	"YouTube/history/watch-history.html",
	"Location History/Location History.json",
}

//Items that shouldn't be added because they are not insightful
var blackList = []string{"Google Search", "Ads", "Chrome", "a video that has been removed", "Search", "YouTube", "Assistant"}

var dbLocation = ""

type Message struct {
	Type    string `json:"type"`
	Payload string `json:"payload"`
}

func getTotalItems(year string) (int, error) {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return 0, err
	}
	defer db.Close()

	if year == "total" {
		results, err := ParseTakeout.GetAllItems(db)
		if err != nil {
			return 0, err
		}
		return len(results), nil
	}

	yearStr, err := strconv.Atoi(year)
	if err != nil {
		return 0, err
	}

	results, err := ParseTakeout.GetItemsFromYear(db, yearStr)
	if err != nil {
		return 0, err
	}

	return len(results), nil
}

func getYears() ([]int, error) {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	years, err := ParseTakeout.GetYears(db)
	if err != nil {
		return nil, err
	}

	return years, nil
}

func searchItems(searchString string) ([]ParseTakeout.Result, error) {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	results, err := ParseTakeout.SearchItems(db, url.QueryEscape(searchString))
	if err != nil {
		return nil, err
	}

	return results, nil
}

func exists(name string) bool {
	if _, err := os.Stat(name); err != nil {
		if os.IsNotExist(err) {
			return false
		}
	}
	return true
}

func isBlacklistItem(result ParseTakeout.Result) bool {
	for _, b := range blackList {
		if result.Item == b {
			return true
		}
	}
	return false
}

func importTakeout(root string) error {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return err
	}
	defer db.Close()
	for _, filePath := range filesToParse {

		if exists(path.Join(root, filePath)) {
			if filePath == "Location History/Location History.json" {
				data, err := ParseTakeout.LoadJSON(path.Join(root, filePath))
				if err != nil {
					return err
				}

				ParseTakeout.BeginTransaction(db)
				for _, loc := range data.Locations {
					err := ParseTakeout.InsertLocation(db, ParseTakeout.FormatInput(loc))
					if err != nil {
						fmt.Println(err)
						fmt.Println(loc)
					}
				}
				ParseTakeout.CommitTransaction(db)

			} else {
				results, err := ParseTakeout.ParseHTML(path.Join(root, filePath))
				if err != nil {
					return err
				}
				ParseTakeout.BeginTransaction(db)
				//Do something with the results
				for _, result := range results {
					err := result.Validate()
					if err == nil {
						if !isBlacklistItem(result) {
							err := ParseTakeout.InsertItem(db, result)
							if err != nil {
								fmt.Println(err)
								fmt.Println(result)
							}
						}
					}
				}
				ParseTakeout.CommitTransaction(db)
			}
		}
	}
	return nil
}

func getSummary(year int) (*ParseTakeout.YearlySummary, error) {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	summary, err := ParseTakeout.GetSummaryofYear(db, year)
	if err != nil {
		return nil, err
	}

	return summary, nil
}

func getSummaryTotal() (*ParseTakeout.TotalSummary, error) {
	db, err := ParseTakeout.OpenDB(dbLocation)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	summary, err := ParseTakeout.GetTotalSummary(db)
	if err != nil {
		return nil, err
	}

	return summary, nil
}

func constructResponse(payload interface{}) ([]byte, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	message := Message{
		Type:    "response",
		Payload: string(payloadJSON),
	}

	messageJSON, err := json.Marshal(message)
	if err != nil {
		return nil, err
	}

	return messageJSON, nil
}

func handleMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "", http.StatusBadRequest)
		return
	}

	var message Message
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&message)
	if err != nil {
		http.Error(w, "Unable to decode JSON", http.StatusBadRequest)
		return
	}

	switch message.Type {
	case "importTakeout":
		err := importTakeout(message.Payload)
		if err != nil {
			log.Println("Unable to import takeout data " + err.Error())
			http.Error(w, "", http.StatusInternalServerError)
			return
		}
		responseJSON, err := constructResponse("Succesfuly Imported Data")
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}
		w.Write(responseJSON)

	case "getCount":
		count, err := getTotalItems(message.Payload)
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}
		responseJSON, err := constructResponse(count)
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		w.Write(responseJSON)
	case "getYears":
		years, err := getYears()
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		yearsStr := []string{}
		for _, year := range years {
			yearsStr = append(yearsStr, fmt.Sprintf("%d", year))
		}

		responseJSON, err := constructResponse(yearsStr)
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		w.Write(responseJSON)
	case "searchItems":
		results, err := searchItems(message.Payload)
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		responseJSON, err := constructResponse(results)
		if err != nil {
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		w.Write(responseJSON)
	case "getYearlySummary":
		var responseJSON []byte

		if message.Payload == "Total" {
			summary, err := getSummaryTotal()
			if err != nil {
				http.Error(w, "", http.StatusInternalServerError)
				return
			}
			responseJSON, err = constructResponse(*summary)
			if err != nil {
				http.Error(w, "", http.StatusInternalServerError)
				return
			}
		} else {
			year := message.Payload
			yearInt, _ := strconv.Atoi(year)

			summary, err := getSummary(yearInt)
			if err != nil {
				http.Error(w, "", http.StatusInternalServerError)
				return
			}
			responseJSON, err = constructResponse(*summary)
			if err != nil {
				http.Error(w, "", http.StatusInternalServerError)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")

		w.Write(responseJSON)
	}
}

func main() {
	var dbLocationFlag = flag.String("db", "", "Set db location")
	flag.Parse()

	if *dbLocationFlag == "" {
		log.Fatal("Please set dbLocation")
	}

	dbLocation = *dbLocationFlag

	log.Println("DB location: " + dbLocation)

	log.Println("Running dataserver")

	http.HandleFunc("/", handleMessage)

	log.Fatal(http.ListenAndServe("localhost:40855", nil))
}
