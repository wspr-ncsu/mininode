import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from pandas.plotting import register_matplotlib_converters
register_matplotlib_converters()

filename = 'npm-post.csv'
df = pd.read_csv(filename, delimiter=',')

df = df.drop_duplicates() # dropping duplicated datas

print(df['total'].max(), df['declared'].max())

# df.loc[df['declaredDependencyCount'] == 0, ['installedTotalDependencyCount', 'installedUniqueDependencyCount']] = 0

Y = df['declared'].value_counts(normalize=True).sort_index()

Y2 = df['total'].value_counts(normalize=True).sort_index()

# Y3 = df['unique'].value_counts(normalize=True).sort_index()

CY = np.cumsum(Y) * 100
CY2 = np.cumsum(Y2) * 100
# CY3 = np.cumsum(Y3) * 100

sns.set(style="whitegrid")
plt.xscale('symlog')
ax = sns.lineplot(data=CY, palette="tab10", linewidth=2)
ax.set(xlabel='packages', ylabel='percentage')
sns.lineplot(data=CY2, palette="tab10", linewidth=2, dashes=True)
# sns.lineplot(data=CY3, palette="tab10", linewidth=2.5, legend='brief')
plt.show()