v1.6

Compute the average score of a DPC setup, given a solution set.  
Takes into account tspins, quads, line clears, combos.  
Doesn't currently take into account sd/hd points.

Usage:
1) Gather your solution set. Minimals, extra scoring solutions, whatever. Get them in glued fumen format. [fumen solutions]
2) precompute cover and nohold cover with sfinder
    - Example commands:
    - java -jar sfinder.jar cover -d 180 -p *p7 -t [fumen solutions]
    - java -jar sfinder.jar cover -d 180 -p *p7 -t [fumen solutions] --hold avoid -o output/cover_nohold.csv
3) name them output/cover.csv and output/cover_nohold.csv and throw them in the same folder as this script
4) run script
    - node avg_score.js

Hopefully it should output an average score.

Adjust base get_score() call arguments to configure initial b2b, initial combo, and b2b end bonus

Notes:  
This assumes the solutions are valid and the cover.csv files were generated correctly. There's very little error handling.  
There are a couple debugging console logs, comment them out if you wish.  
For non 100% setups, comment out the "PC fail queue" throw statement. This will give that queue -3000 points in the average.  
Script should compute accurately on solution queues without dupes e.g. *p7 - for solution queues with dupes, the code is set up to _try_, but the result may not be accurate, likely overscoring. This is due to information loss (queue string + solution no longer necessarily refers to exactly one sequence) and the lack of a **true** SRS placeability check in the code. By default the code should ship with errors that trigger on dupe piece queues. You may comment them out to get results but those results aren’t currently guaranteed to be accurate.  
Solution queues with dupes have a large set of hold reorderings that may be annoying to compute with sfinder. By default the code ships with an error thrown when nohold cover data is incomplete. If it's too annoying to get sfinder compute the weird complete set, you can adjust the logic a little. Again, without a true SRS placeability check, results aren't guaranteed to be accurate.