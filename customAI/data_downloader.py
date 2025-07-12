import os, sys, time, json, urllib3, requests, multiprocessing, time
#os - provides function to interact with os (file paths)
#sys - System-specific parameters and functions -
urllib3.disable_warnings()

sleep = 1
year = 2021
def download_function(collection):
    ''' '''

    request, lat, long, frp, key = collection
    response = requests.get(url=request, verify=False, timeout=30.00).text
    global sleep
    global year

    # Exponential backoff in case the request is throttled/errored
    if "failed" in response:
        print("Request getting throttled/errored : " + response)
        sleep = min(sleep * 2, 64)
        print ("Sleeping for " + str(sleep) + " seconds")
        time.sleep(sleep)
    else:
        sleep = 1
        response = response.replace("YEAR,DOY,T2M,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN,GWETPROF", "").strip()

        f = open("processed_data/aggregated_data_" + str(year) + ".csv", "a")
        global year

        Start_Time = time.time()

        requests = []
        fetched_dataset = build_fetched_dataset("processed_data/aggregated_data_" + str(year) + ".csv")

        lat_long_date_frp_array = read_file_to_array("raw_data/modis_"+ str(year) + "_United_States.csv")
        for item in lat_long_date_frp_array:
            (latitude, longitude, date, frp) = (item[0], item[1], item[2], item[3])
            key = date + "_" + latitude + "_" + longitude
            if  key in fetched_dataset:
                print("Skipping " + key)
                continue

            request = self.request_template.format(latitude=latitude, longitude=longitude, date=date)
            requests.append((request, latitude, longitude, frp, key))

        pool = multiprocessing.Pool(self.processes)
        x = pool.imap_unordered(download_function, requests)

        total_rows = len(lat_long_date_frp_array)
        already_fetched = len(fetched_dataset)
        for i, df in enumerate(x, 1):
            sys.stderr.write('\rExporting {0:%}'.format((already_fetched + i)/total_rows))